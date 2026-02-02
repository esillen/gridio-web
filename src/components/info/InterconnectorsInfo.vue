<template>
  <div class="info-content">
    <div class="hero-image">
      <img src="https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?w=800&h=400&fit=crop" alt="Power Lines" />
    </div>
    <div class="hero">
      <h2>Grid Interconnectors</h2>
    </div>
    
    <div class="quick-facts">
      <div class="fact">
        <span class="fact-label">Import Capacity</span>
        <span class="fact-value">~8,000 MW</span>
      </div>
      <div class="fact">
        <span class="fact-label">Export Capacity</span>
        <span class="fact-value">~6,000 MW</span>
      </div>
      <div class="fact">
        <span class="fact-label">Connected Countries</span>
        <span class="fact-value">6</span>
      </div>
      <div class="fact">
        <span class="fact-label">Technology</span>
        <span class="fact-value">HVDC & AC</span>
      </div>
    </div>

    <div class="body-text">
      <h3>Overview</h3>
      <p>
        Interconnectors are high-voltage transmission lines linking Sweden's grid to neighboring countries, enabling 
        electricity trade across borders. These connections enhance energy security, enable access to diverse generation, 
        and create market efficiency through price arbitrage.
      </p>

      <h3>Role in the Swedish Grid</h3>
      <p>
        Sweden's interconnectors handle 10-20% of total electricity flow (imports + exports). The country typically exports 
        surplus hydro and nuclear power to southern neighbors during wet years, while importing during dry years or high 
        domestic demand. Real-time power flows help balance the Nordic grid, with Sweden often acting as the region's 
        "battery" by storing energy in reservoirs when regional prices are low.
      </p>

      <h3>Technology</h3>
      <p>
        Sweden uses both AC (alternating current) and HVDC (high-voltage direct current) interconnectors. 
        Major connections include: Norway (multiple HVDC and AC links), Denmark (HVDC), Finland (AC), Germany (HVDC cables 
        through Baltic Sea), Poland (HVDC SwePol Link), and Lithuania (NordBalt HVDC). Modern HVDC converters enable 
        precise power control and can even provide frequency support. Subsea cables spanning hundreds of kilometers 
        use specialized insulation and operate at 400-500 kV.
      </p>

      <h3>2026 Context</h3>
      <p>
        Sweden's interconnector strategy is evolving rapidly. New cables to continental Europe are under construction to 
        access wind power from the North Sea and provide flexibility for German renewable integration. However, internal 
        transmission bottlenecks create "bidding zones" where northern Sweden has surplus cheap power while the south 
        experiences higher prices and congestion. This has sparked debate about grid investment priorities. Svenska Kraftnät 
        (the TSO) carefully manages flows to maintain system stability, sometimes limiting interconnector usage when 
        internal constraints bind.
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
