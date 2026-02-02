<template>
  <div class="info-content">
    <div class="hero-image">
      <img src="https://images.unsplash.com/photo-1611365892117-00ac5ef43c90?w=800&h=400&fit=crop" alt="Nuclear Power Plant" />
    </div>
    <div class="hero">
      <h2>Nuclear Power</h2>
    </div>
    
    <div class="quick-facts">
      <div class="fact">
        <span class="fact-label">Capacity in Sweden</span>
        <span class="fact-value">~6,900 MW</span>
      </div>
      <div class="fact">
        <span class="fact-label">Type</span>
        <span class="fact-value">Baseload</span>
      </div>
      <div class="fact">
        <span class="fact-label">Fuel</span>
        <span class="fact-value">Uranium-235</span>
      </div>
      <div class="fact">
        <span class="fact-label">CO₂ Emissions</span>
        <span class="fact-value">~12 g/kWh</span>
      </div>
    </div>

    <div class="body-text">
      <h3>Overview</h3>
      <p>
        Nuclear power is a cornerstone of Sweden's electricity system, providing reliable baseload power with minimal carbon emissions. 
        As of 2026, Sweden operates six nuclear reactors across three sites: Forsmark (3 reactors), Ringhals (2 reactors), and Oskarshamn (1 reactor).
      </p>

      <h3>Role in the Swedish Grid</h3>
      <p>
        Nuclear power supplies approximately 30-40% of Sweden's electricity, operating continuously at high capacity factors (>85%). 
        These plants provide essential grid stability and act as the backbone of Sweden's low-carbon energy system.
      </p>

      <h3>Technology</h3>
      <p>
        Swedish nuclear plants use light water reactors (both boiling water and pressurized water designs). 
        They generate heat through controlled nuclear fission, producing steam to drive turbines. 
        The fuel cycle involves mining, enrichment, reactor operation, and long-term waste management.
      </p>

      <h3>2026 Context</h3>
      <p>
        Sweden is in the midst of a nuclear renaissance, with political consensus supporting both life extensions of existing reactors 
        and plans for new small modular reactors (SMRs). The government has reversed earlier phase-out decisions, recognizing nuclear's 
        role in achieving climate neutrality while maintaining industrial competitiveness.
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
