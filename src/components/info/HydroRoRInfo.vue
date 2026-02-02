<template>
  <div class="info-content">
    <div class="hero-image">
      <img src="https://images.unsplash.com/photo-1563330232-57114bb0823c?w=800&h=400&fit=crop" alt="Water Turbine" />
    </div>
    <div class="hero">
      <h2>Run-of-River Hydro</h2>
    </div>
    
    <div class="quick-facts">
      <div class="fact">
        <span class="fact-label">Capacity in Sweden</span>
        <span class="fact-value">~7,500 MW</span>
      </div>
      <div class="fact">
        <span class="fact-label">Type</span>
        <span class="fact-value">Variable Renewable</span>
      </div>
      <div class="fact">
        <span class="fact-label">Storage</span>
        <span class="fact-value">Hours to days</span>
      </div>
      <div class="fact">
        <span class="fact-label">CO₂ Emissions</span>
        <span class="fact-value">~18 g/kWh</span>
      </div>
    </div>

    <div class="body-text">
      <h3>Overview</h3>
      <p>
        Run-of-river (RoR) hydropower generates electricity from the natural flow of rivers without large storage reservoirs. 
        These plants use the kinetic energy of flowing water, with minimal water retention upstream.
      </p>

      <h3>Role in the Swedish Grid</h3>
      <p>
        RoR plants contribute about 15-20% of Sweden's electricity, operating continuously but with output varying seasonally based 
        on river flow. They provide predictable baseline generation during high-flow periods (spring snowmelt, autumn rains) but 
        produce less during dry summer months and frozen winter conditions.
      </p>

      <h3>Technology</h3>
      <p>
        RoR facilities typically feature low-head turbines (Kaplan or bulb turbines) that operate efficiently with small elevation 
        differences. They may have small pondage (hours to days of storage) to smooth daily generation, but cannot provide 
        seasonal storage like reservoir hydro. Modern installations include fish passages and environmental flow releases.
      </p>

      <h3>2026 Context</h3>
      <p>
        Sweden's many rivers, especially in the north and along major waterways like Lule älv and Ångerman älv, host numerous 
        RoR plants. New environmental regulations require careful balancing between electricity generation and ecosystem protection. 
        Climate change is affecting river flow patterns, with earlier spring melts and more variable precipitation affecting 
        year-round generation profiles.
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
