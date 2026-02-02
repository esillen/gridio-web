<template>
  <div class="info-content">
    <div class="hero-image">
      <img src="https://images.unsplash.com/photo-1509391366360-2e959784a276?w=800&h=400&fit=crop" alt="Solar Panels" />
    </div>
    <div class="hero">
      <h2>Solar PV Power</h2>
    </div>
    
    <div class="quick-facts">
      <div class="fact">
        <span class="fact-label">Capacity in Sweden</span>
        <span class="fact-value">~3,500 MW</span>
      </div>
      <div class="fact">
        <span class="fact-label">Type</span>
        <span class="fact-value">Variable Renewable</span>
      </div>
      <div class="fact">
        <span class="fact-label">Capacity Factor</span>
        <span class="fact-value">~12%</span>
      </div>
      <div class="fact">
        <span class="fact-label">CO₂ Emissions</span>
        <span class="fact-value">~41 g/kWh</span>
      </div>
    </div>

    <div class="body-text">
      <h3>Overview</h3>
      <p>
        Solar photovoltaic (PV) power converts sunlight directly into electricity using semiconductor materials. 
        While Sweden's northern latitude presents challenges, solar has become increasingly viable due to falling costs 
        and improved efficiency.
      </p>

      <h3>Role in the Swedish Grid</h3>
      <p>
        Solar PV contributes about 2-3% of Sweden's annual electricity, but its share is growing rapidly. Most capacity 
        consists of rooftop installations on commercial and residential buildings, with utility-scale solar farms emerging 
        in southern Sweden. Solar generation peaks during summer afternoons and drops to near-zero in winter, creating a 
        strong seasonal pattern. Daily generation varies from 0 hours (polar winter nights) to 18+ hours (summer midnight sun).
      </p>

      <h3>Technology</h3>
      <p>
        Modern Swedish installations predominantly use monocrystalline silicon panels with 20-22% efficiency. 
        Bifacial panels that capture reflected light from snow are gaining popularity. Most systems use string inverters 
        or microinverters to convert DC to AC. Cold temperatures actually improve panel efficiency, though snow accumulation 
        can reduce output. Tracking systems are rare due to high installation costs at this latitude.
      </p>

      <h3>2026 Context</h3>
      <p>
        Sweden's solar sector is experiencing explosive growth, with installations doubling every 2-3 years. Government 
        incentives for rooftop solar, combined with high electricity prices and environmental awareness, are driving 
        residential adoption. Industrial facilities are adding large rooftop arrays to reduce grid demand. Despite low 
        winter output, solar provides valuable peak shaving during summer months when hydro reservoirs can be conserved. 
        Grid operators are developing new forecasting tools to predict solar variability.
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
