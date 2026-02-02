<template>
  <div class="info-content">
    <div class="hero-image">
      <img src="https://images.unsplash.com/photo-1532601224476-15c79f2f7a51?w=800&h=400&fit=crop" alt="Wind Turbines" />
    </div>
    <div class="hero">
      <h2>Wind Power</h2>
    </div>
    
    <div class="quick-facts">
      <div class="fact">
        <span class="fact-label">Capacity in Sweden</span>
        <span class="fact-value">~16,000 MW</span>
      </div>
      <div class="fact">
        <span class="fact-label">Type</span>
        <span class="fact-value">Variable Renewable</span>
      </div>
      <div class="fact">
        <span class="fact-label">Capacity Factor</span>
        <span class="fact-value">~32%</span>
      </div>
      <div class="fact">
        <span class="fact-label">CO₂ Emissions</span>
        <span class="fact-value">~11 g/kWh</span>
      </div>
    </div>

    <div class="body-text">
      <h3>Overview</h3>
      <p>
        Wind power is Sweden's fastest-growing electricity source, harnessing kinetic energy from air movement using large turbines. 
        Modern wind farms feature turbines with rotor diameters exceeding 150 meters and hub heights over 100 meters.
      </p>

      <h3>Role in the Swedish Grid</h3>
      <p>
        Wind power supplies approximately 15-20% of Sweden's annual electricity generation, with the share growing rapidly. 
        The majority of capacity is onshore, concentrated in southern and central Sweden where wind resources are strongest. 
        Wind generation is highly variable, ranging from near-zero during calm periods to over 60% capacity factor during 
        strong weather systems.
      </p>

      <h3>Technology</h3>
      <p>
        Swedish wind farms predominantly use three-blade horizontal-axis turbines with active pitch and yaw control. 
        Turbines cut in around 3 m/s wind speed, reach rated power at 12-15 m/s, and cut out at 25 m/s for safety. 
        Modern turbines are equipped with grid-forming capabilities, helping maintain frequency stability. Offshore wind 
        development is beginning off the coast of Skåne and in the Baltic Sea.
      </p>

      <h3>2026 Context</h3>
      <p>
        Sweden is experiencing a wind power boom driven by industrial electrification demand and carbon-neutral commitments. 
        Major investments are flowing into northern Sweden to power green steel and battery factories. The grid operator 
        faces growing challenges integrating this variable generation, requiring expanded transmission capacity and increased 
        flexibility from other assets. Planning reforms have accelerated, but local opposition remains a concern in some regions.
      </p>
    </div>
  </div>
</template>

<style scoped>
.info-content {
  padding: 0;
}

.hero-image {
  width: 100%;
  height: 250px;
  overflow: hidden;
  border-radius: 16px 16px 0 0;
}

.hero-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.hero {
  text-align: center;
  margin-bottom: 1.5rem;
  padding: 2rem 2rem 0;
}

.icon {
  font-size: 4rem;
  margin-bottom: 0.5rem;
}

h2 {
  color: var(--color-gray-900);
  font-size: 1.75rem;
  font-weight: 700;
  margin: 0;
}

.quick-facts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin: 0 2rem 2rem;
  padding: 1.25rem;
  background: var(--color-gray-50);
  border-radius: 12px;
}

.fact {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.fact-label {
  font-size: 0.75rem;
  color: var(--color-gray-600);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.fact-value {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-gray-900);
}

.body-text {
  line-height: 1.6;
  padding: 0 2rem 2rem;
}

.body-text h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-gray-800);
  margin: 1.5rem 0 0.75rem;
}

.body-text h3:first-child {
  margin-top: 0;
}

.body-text p {
  color: var(--color-gray-700);
  margin: 0 0 1rem;
}

.body-text p:last-child {
  margin-bottom: 0;
}
</style>
