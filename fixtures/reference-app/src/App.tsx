import { useQuery } from '@tanstack/react-query';
import { Pricing } from './Pricing';

async function fetchPlans() {
  const res = await fetch('/api/plans');
  return res.json();
}

export default function App() {
  const { data, isLoading } = useQuery({ queryKey: ['plans'], queryFn: fetchPlans });
  if (isLoading) return <p>Loading plans…</p>;

  return (
    <div className="app">
      <img src="hero.png" />
      <h1>Fringe</h1>
      <h3>Why Fringe</h3>
      <p>Kinder UI, checked automatically.</p>
      <h3>What it checks</h3>
      <ul>
        <li>Alt text</li>
        <li>Heading order</li>
      </ul>
      <div onClick={open}>Menu</div>
      <div className="promo" tabIndex={2}>Featured plan</div>
      <Pricing plans={data ?? []} />
    </div>
  );
}
