<template>
  <div class="info-content">
    <div class="hero-image">
      <img src="https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=800&h=400&fit=crop" alt="CHP Plant" />
    </div>
    <div class="hero">
      <h2>Combined Heat & Power (CHP)</h2>
    </div>
    
    <div class="quick-facts">
      <div class="fact">
        <span class="fact-label">Capacity in Sweden</span>
        <span class="fact-value">~4,500 MW</span>
      </div>
      <div class="fact">
        <span class="fact-label">Type</span>
        <span class="fact-value">Dispatchable</span>
      </div>
      <div class="fact">
        <span class="fact-label">Efficiency</span>
        <span class="fact-value">85-90%</span>
      </div>
      <div class="fact">
        <span class="fact-label">Fuel</span>
        <span class="fact-value">Biofuels, Waste</span>
      </div>
    </div>

    <div class="body-text">
      <h3>Overview</h3>
      <p>
        Combined Heat and Power plants simultaneously produce electricity and useful heat, achieving much higher overall 
        efficiency than separate generation. In Sweden, most CHP plants are connected to district heating networks that 
        warm buildings in urban areas.
      </p>

      <h3>Role in the Swedish Grid</h3>
      <p>
        CHP contributes about 8-10% of Sweden's electricity generation, with output varying seasonally based on heating demand. 
        These plants are particularly important during cold winter months when both electricity and heating demand peak. 
        CHP provides dispatchable generation that can respond to grid needs, though operation is constrained by heat demand 
        from the district heating network.
      </p>

      <h3>Technology</h3>
      <p>
        Swedish CHP plants predominantly use biofuels (wood chips, pellets, forest residues) and municipal waste, making them 
        largely carbon-neutral. Common technologies include steam turbines, gas turbines with heat recovery, and reciprocating 
        engines. Industrial CHP uses process heat from factories, particularly in pulp and paper mills. The heat-to-power ratio 
        typically ranges from 2:1 to 4:1, with electricity as a valuable by-product of heat generation.
      </p>

      <h3>2026 Context</h3>
      <p>
        Sweden's extensive district heating infrastructure (serving ~50% of residential buildings) makes CHP economically 
        attractive. The sector is transitioning away from fossil fuels, with coal and oil phases completed. New regulations 
        promote biofuel sourcing from sustainable forestry. CHP operators increasingly provide flexibility services to the 
        grid, using heat storage to decouple electricity production from instantaneous heat demand. Some facilities are adding 
        heat pumps and thermal storage to maximize revenue from high-price electricity periods.
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
