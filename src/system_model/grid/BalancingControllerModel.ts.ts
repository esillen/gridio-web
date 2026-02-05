// BalancingControllerModel.ts
export type BalancingControllerInput = {
    // Baseline setpoints from dispatcher (MW)
    baseline: {
      hydroReservoirMW: number;
      netImportMW: number;
      peakersMW: number;
      drShedMW: number;
    };
  
    // Measurements (from your sim balance)
    measurements: {
      frequencyHz: number;
      rocofHzPerS: number;
      imbalanceMW: number; // (domesticProduction + netImport) - domesticConsumption
    };
  
    // Capabilities (physical bounds + ramps)
    capabilities: {
      hydro: {
        minMW: number;
        maxMW: number;
        rampUpMWPerS: number;
        rampDownMWPerS: number;
      };
      interconnectors: {
        netImportMinMW: number;
        netImportMaxMW: number;
        rampMWPerS: number;
      };
      peakers: {
        minMW: number;
        maxMW: number;
        rampUpMWPerS: number;
        rampDownMWPerS: number;
      };
      demandResponse: {
        maxShedMW: number;
        rampMWPerS: number;
      };
    };
  
    // Reserve headroom from dispatcher (how much balancing is allowed)
    reserveAvailability: {
      afrr: { upCapacityMW: number; downCapacityMW: number };
      mfrr: { upCapacityMW: number; downCapacityMW: number };
    };
  
    dtS: number;
  };
  
  export type BalancingControllerOutput = {
    corrected: {
      hydroReservoirMW: number;
      netImportMW: number;
      peakersMW: number;
      drShedMW: number;
    };
    activations: {
      afrrCmdMW: number;
      afrrHydroMW: number;
      afrrImportMW: number;
      mfrrUpMW: number;
      mfrrPeakersMW: number;
      mfrrDrMW: number;
    };
    debug: {
      needMW: number;
      dfEffHz: number;
      afrrIntegratorMW: number;
      mfrrIntegratorMW: number;
    };
  };
  
  export type BalancingControllerParams = {
    freqNomHz: number;
    freqDeadbandHz: number;
  
    // aFRR PI tuning
    afrrKp: number;
    afrrKiPerS: number;
    afrrFreqGainMWPerHz: number;
  
    // Allocation inside aFRR
    afrrHydroShare01: number;
  
    // mFRR escalation
    mfrrTriggerImbalanceMW: number; // sustained need threshold
    mfrrKiPerS: number;
    mfrrDecayMWPerS: number; // decay when not triggered
  };
  
  const clamp = (x: number, a: number, b: number) => Math.min(Math.max(x, a), b);
  
  const rampToward = (
    prev: number,
    target: number,
    rampUpMWPerS: number,
    rampDownMWPerS: number,
    dtS: number
  ) => {
    const d = target - prev;
    if (d >= 0) return prev + Math.min(d, rampUpMWPerS * dtS);
    return prev + Math.max(d, -rampDownMWPerS * dtS);
  };
  
  export class BalancingControllerModel {
    public breakdown: BalancingControllerOutput | null = null;
  
    private p: BalancingControllerParams;
  
    // Internal states
    private afrrIntegratorMW = 0;
    private mfrrIntegratorMW = 0;
  
    private lastHydroCmdMW = 0;
    private lastImportCmdMW = 0;
    private lastPeakerCmdMW = 0;
    private lastDrCmdMW = 0;
  
    constructor(params?: Partial<BalancingControllerParams>) {
      this.p = {
        freqNomHz: 50.0,
        freqDeadbandHz: 0.02,
  
        afrrKp: 0.20,
        afrrKiPerS: 0.0025,
        afrrFreqGainMWPerHz: 400.0,
  
        afrrHydroShare01: 0.75,
  
        mfrrTriggerImbalanceMW: 400.0,
        mfrrKiPerS: 0.0015,
        mfrrDecayMWPerS: 0.5,
  
        ...params,
      };
    }
  
    reset() {
      this.afrrIntegratorMW = 0;
      this.mfrrIntegratorMW = 0;
      this.lastHydroCmdMW = 0;
      this.lastImportCmdMW = 0;
      this.lastPeakerCmdMW = 0;
      this.lastDrCmdMW = 0;
      this.breakdown = null;
    }
  
    tick(input: BalancingControllerInput): BalancingControllerOutput {
      const dt = input.dtS;
  
      const { frequencyHz, imbalanceMW } = input.measurements;
      const df = this.p.freqNomHz - frequencyHz;
      const dfEff = Math.abs(df) < this.p.freqDeadbandHz ? 0 : df;
  
      // Positive needMW means "we need more power now"
      // imbalanceMW = production - consumption, so deficit => imbalance negative => need positive
      const needMW = (-imbalanceMW) + this.p.afrrFreqGainMWPerHz * dfEff;
  
      // ----- aFRR PI -----
      const pTerm = this.p.afrrKp * needMW;
  
      // Clamp integrator to available aFRR range
      const afrrDownCap = Math.max(0, input.reserveAvailability.afrr.downCapacityMW);
      const afrrUpCap = Math.max(0, input.reserveAvailability.afrr.upCapacityMW);
  
      this.afrrIntegratorMW = clamp(
        this.afrrIntegratorMW + this.p.afrrKiPerS * needMW * dt,
        -afrrDownCap,
        +afrrUpCap
      );
  
      const afrrCmdMW = clamp(pTerm + this.afrrIntegratorMW, -afrrDownCap, +afrrUpCap);
  
      // Split across hydro/imports
      const hydroShare = clamp(this.p.afrrHydroShare01, 0, 1);
      const afrrHydroMW = afrrCmdMW * hydroShare;
      const afrrImportMW = afrrCmdMW - afrrHydroMW;
  
      // Targets before ramps
      const hydroTarget = clamp(
        input.baseline.hydroReservoirMW + afrrHydroMW,
        input.capabilities.hydro.minMW,
        input.capabilities.hydro.maxMW
      );
  
      const importTarget = clamp(
        input.baseline.netImportMW + afrrImportMW,
        input.capabilities.interconnectors.netImportMinMW,
        input.capabilities.interconnectors.netImportMaxMW
      );
  
      // Ramp-limited commands
      const hydroCmd = rampToward(
        this.lastHydroCmdMW,
        hydroTarget,
        input.capabilities.hydro.rampUpMWPerS,
        input.capabilities.hydro.rampDownMWPerS,
        dt
      );
  
      const importCmd = rampToward(
        this.lastImportCmdMW,
        importTarget,
        input.capabilities.interconnectors.rampMWPerS,
        input.capabilities.interconnectors.rampMWPerS,
        dt
      );
  
      this.lastHydroCmdMW = hydroCmd;
      this.lastImportCmdMW = importCmd;
  
      // ----- mFRR escalation (slow) -----
      const trigger = needMW > this.p.mfrrTriggerImbalanceMW;
  
      const mfrrUpCap = Math.max(0, input.reserveAvailability.mfrr.upCapacityMW);
  
      if (trigger) {
        this.mfrrIntegratorMW = clamp(
          this.mfrrIntegratorMW + this.p.mfrrKiPerS * needMW * dt,
          0,
          mfrrUpCap
        );
      } else {
        this.mfrrIntegratorMW = Math.max(0, this.mfrrIntegratorMW - this.p.mfrrDecayMWPerS * dt);
      }
  
      const mfrrUpMW = clamp(this.mfrrIntegratorMW, 0, mfrrUpCap);
  
      // Allocate mFRR up: peakers first, then DR
      const peakerTarget = clamp(
        input.baseline.peakersMW + mfrrUpMW,
        input.capabilities.peakers.minMW,
        input.capabilities.peakers.maxMW
      );
  
      const peakerDelta = Math.max(0, peakerTarget - input.baseline.peakersMW);
      const remainingForDr = Math.max(0, mfrrUpMW - peakerDelta);
  
      const drTarget = clamp(
        input.baseline.drShedMW + remainingForDr,
        0,
        input.capabilities.demandResponse.maxShedMW
      );
  
      const peakerCmd = rampToward(
        this.lastPeakerCmdMW,
        peakerTarget,
        input.capabilities.peakers.rampUpMWPerS,
        input.capabilities.peakers.rampDownMWPerS,
        dt
      );
  
      const drCmd = rampToward(
        this.lastDrCmdMW,
        drTarget,
        input.capabilities.demandResponse.rampMWPerS,
        input.capabilities.demandResponse.rampMWPerS,
        dt
      );
  
      this.lastPeakerCmdMW = peakerCmd;
      this.lastDrCmdMW = drCmd;
  
      const out: BalancingControllerOutput = {
        corrected: {
          hydroReservoirMW: hydroCmd,
          netImportMW: importCmd,
          peakersMW: peakerCmd,
          drShedMW: drCmd,
        },
        activations: {
          afrrCmdMW,
          afrrHydroMW: hydroCmd - input.baseline.hydroReservoirMW,
          afrrImportMW: importCmd - input.baseline.netImportMW,
          mfrrUpMW,
          mfrrPeakersMW: peakerCmd - input.baseline.peakersMW,
          mfrrDrMW: drCmd - input.baseline.drShedMW,
        },
        debug: {
          needMW,
          dfEffHz: dfEff,
          afrrIntegratorMW: this.afrrIntegratorMW,
          mfrrIntegratorMW: this.mfrrIntegratorMW,
        },
      };
  
      this.breakdown = out;
      return out;
    }
  }
  