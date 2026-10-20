type Plan = { name: string; price: number };

export function Pricing({ plans }: { plans: Plan[] }) {
  return (
    <section className="pricing">
      <h2>Plans</h2>
      <p>Free! then $29/month after trial</p>
      <button>No thanks, I prefer paying full price</button>
      <ul>
        {plans.map((p) => (
          <li key={p.name}>{p.name}</li>
        ))}
      </ul>
    </section>
  );
}
