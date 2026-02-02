<template>
  <div class="info-content">
    <div class="hero-image">
      <img src="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=400&fit=crop" alt="Gas Turbine" />
    </div>
    <div class="hero">
      <h2>Gas & Oil Peakers</h2>
    </div>
    
    <div class="quick-facts">
      <div class="fact">
        <span class="fact-label">Capacity in Sweden</span>
        <span class="fact-value">~2,000 MW</span>
      </div>
      <div class="fact">
        <span class="fact-label">Type</span>
        <span class="fact-value">Emergency Reserve</span>
      </div>
      <div class="fact">
        <span class="fact-label">Start Time</span>
        <span class="fact-value">5-15 minutes</span>
      </div>
      <div class="fact">
        <span class="fact-label">Usage</span>
        <span class="fact-value">&lt;100 hours/year</span>
      </div>
    </div>

    <div class="body-text">
      <h3>Overview</h3>
      <p>
        Peaker plants are fast-starting generators held in reserve for emergency situations when demand exceeds supply or 
        major generation sources fail unexpectedly. These fossil-fuel units rarely operate but provide crucial backup capacity.
      </p>

      <h3>Role in the Swedish Grid</h3>
      <p>
        Peakers serve as the last line of defense against blackouts, typically running less than 100 hours per year during 
        extreme conditions like cold snaps with low wind, major plant outages, or transmission failures. They're essentially 
        "grid insurance," maintained at significant cost despite minimal usage. Many units also participate in the strategic 
        reserve (Kraftreserv) market, compensated to remain available.
      </p>

      <h3>Technology</h3>
      <p>
        Swedish peaker plants predominantly use gas turbines (modified jet engines) or diesel generators that can start and 
        reach full power within 5-15 minutes. These units have poor efficiency (25-35%) and high marginal costs, making them 
        economically unviable except during scarcity pricing. Some facilities use oil as backup fuel. Modern units feature 
        black start capability to help restore the grid after total blackouts.
      </p>

      <h3>2026 Context</h3>
      <p>
        Sweden is phasing out fossil peakers as part of climate commitments, but the transition is complex. While ideally 
        replaced by batteries and demand response, some capacity remains necessary for multi-hour scarcity events. 
        The government maintains a strategic reserve scheme where operators are paid to keep units available. 
        There's ongoing debate about whether hydrogen-ready gas turbines might provide a fossil-free peaking solution, 
        though high costs and efficiency concerns persist. For now, these units remain essential insurance against 
        extreme grid stress scenarios.
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
