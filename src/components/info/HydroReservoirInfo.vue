<template>
  <div class="info-content">
    <div class="hero-image">
      <img src="https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=800&h=400&fit=crop" alt="Lake Reservoir" />
    </div>
    <div class="hero">
      <h2>Hydro Reservoir Power</h2>
    </div>
    
    <div class="quick-facts">
      <div class="fact">
        <span class="fact-label">Capacity in Sweden</span>
        <span class="fact-value">~8,500 MW</span>
      </div>
      <div class="fact">
        <span class="fact-label">Type</span>
        <span class="fact-value">Dispatchable Storage</span>
      </div>
      <div class="fact">
        <span class="fact-label">Storage</span>
        <span class="fact-value">~34 TWh</span>
      </div>
      <div class="fact">
        <span class="fact-label">CO₂ Emissions</span>
        <span class="fact-value">~24 g/kWh</span>
      </div>
    </div>

    <div class="body-text">
      <h3>Overview</h3>
      <p>
        Reservoir hydropower is Sweden's largest source of electricity generation and the country's primary energy storage system. 
        These plants store water behind dams in mountainous regions, releasing it through turbines when electricity is needed.
      </p>

      <h3>Role in the Swedish Grid</h3>
      <p>
        Hydro reservoirs provide approximately 40-45% of Sweden's annual electricity production and serve as the grid's "battery." 
        They can rapidly adjust output from zero to full capacity within minutes, making them invaluable for balancing intermittent 
        wind and solar power. The seasonal storage capacity allows summer rainfall to be saved for winter demand peaks.
      </p>

      <h3>Technology</h3>
      <p>
        Large dams create artificial lakes in mountainous terrain, typically in northern Sweden. When electricity is needed, 
        water flows through penstocks to turn Francis or Kaplan turbines. Modern plants can start generating within 2-3 minutes 
        and reach full output shortly after.
      </p>

      <h3>2026 Context</h3>
      <p>
        Sweden's extensive hydro reservoir system is becoming increasingly valuable as wind and solar capacity expands. 
        Operators use sophisticated forecasting to optimize reservoir levels, balancing immediate spot market prices with 
        future scarcity risk. Environmental regulations require minimum flow releases to protect ecosystems, and climate change 
        is affecting precipitation patterns, making reservoir management more complex.
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
  padding: 2rem 2rem 0;

  text-align: center;
  margin-bottom: 1.5rem;
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
