<template>
  <div class="info-content">
    <div class="hero-image">
      <img src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=400&fit=crop" alt="Smart Grid Dashboard" />
    </div>
    <div class="hero">
      <h2>Demand Response</h2>
    </div>
    
    <div class="quick-facts">
      <div class="fact">
        <span class="fact-label">Potential in Sweden</span>
        <span class="fact-value">~2,000 MW</span>
      </div>
      <div class="fact">
        <span class="fact-label">Type</span>
        <span class="fact-value">Flexible Loads</span>
      </div>
      <div class="fact">
        <span class="fact-label">Response Time</span>
        <span class="fact-value">Seconds to hours</span>
      </div>
      <div class="fact">
        <span class="fact-label">Duration</span>
        <span class="fact-value">Minutes to days</span>
      </div>
    </div>

    <div class="body-text">
      <h3>Overview</h3>
      <p>
        Demand response (DR) involves adjusting electricity consumption in response to grid conditions rather than only 
        adjusting supply. This transforms demand from a fixed requirement into a flexible resource that can help balance 
        the grid.
      </p>

      <h3>Role in the Swedish Grid</h3>
      <p>
        DR is emerging as a key flexibility tool in Sweden's evolving grid. Industrial facilities, district heating systems, 
        and increasingly residential loads can curtail or shift consumption during scarcity or provide fast frequency response. 
        Major industrial consumers (steel mills, mines, data centers, pulp factories) participate in frequency markets 
        (FCR-D), earning revenue by rapidly reducing load when frequency drops. Heat pumps with thermal storage can shift 
        heating load away from peak hours, reducing grid stress.
      </p>

      <h3>Technology</h3>
      <p>
        DR relies on automated control systems that monitor grid signals (price, frequency, TSO commands) and adjust loads 
        accordingly. Common technologies include: smart thermostats that pre-heat buildings before high-price periods, 
        industrial process controllers that modulate production, thermal storage that decouples heat/cold delivery from 
        electricity use, and battery systems at EV charging stations. Modern systems use machine learning to predict 
        optimal curtailment windows while minimizing impact on operations or comfort.
      </p>

      <h3>2026 Context</h3>
      <p>
        Sweden is actively expanding DR programs as variable renewables grow. New regulations mandate that large consumers 
        can be remotely curtailed during emergencies. Smart meter rollout (nearly complete) enables real-time consumption 
        visibility and dynamic pricing. The rise of electric vehicles creates huge DR potential—tens of thousands of EVs 
        can act as distributed storage, charging when power is abundant and cheap. Svenska Kraftnät is developing new market 
        products specifically for demand flexibility. However, aggregating small residential loads remains challenging due to 
        coordination complexity and consumer engagement issues.
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
