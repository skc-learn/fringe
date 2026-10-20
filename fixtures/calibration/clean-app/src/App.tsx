import { useQuery } from '@tanstack/react-query';

type Project = { id: string; name: string; summary: string };

async function fetchProjects(): Promise<Project[]> {
  const res = await fetch('/api/projects');
  if (!res.ok) throw new Error(`projects request failed: ${res.status}`);
  return res.json();
}

export default function App() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
  });

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <nav className="mx-auto flex max-w-4xl items-center justify-between">
          <img src="/logo.svg" alt="Fringe logo" className="h-8 w-8" />
          <a href="/docs" className="text-sm font-medium text-blue-700 underline">Documentation</a>
        </nav>
      </header>

      <section className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="text-3xl font-semibold">Projects</h1>
        <p className="mt-2 text-base text-slate-600">Everything your team shipped this week, in one place.</p>

        <div className="mt-8">
          <label htmlFor="filter" className="block text-sm font-medium text-slate-700">Filter by name</label>
          <input
            id="filter"
            type="search"
            placeholder="Search projects"
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </div>

        {isLoading ? (
          <p className="mt-8 text-sm text-slate-500">Loading projects...</p>
        ) : isError ? (
          <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 text-center">
            <h2 className="text-lg font-semibold">We couldn't load your projects</h2>
            <p className="mt-1 text-sm text-slate-600">
              The request to the projects service failed. Check your connection, then try again.
            </p>
            <button
              onClick={() => refetch()}
              className="mt-4 rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white"
            >
              Try again
            </button>
          </div>
        ) : !data?.length ? (
          <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 text-center">
            <h2 className="text-lg font-semibold">No projects yet</h2>
            <p className="mt-1 text-sm text-slate-600">Create your first project to start tracking findings.</p>
            <button className="mt-4 rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white">New project</button>
          </div>
        ) : (
          <ul className="mt-8 space-y-4">
            {data.map((project) => (
              <li key={project.id} className="rounded-xl border border-slate-200 bg-white p-6">
                <h2 className="text-lg font-semibold">{project.name}</h2>
                <p className="mt-1 text-sm text-slate-600">{project.summary}</p>
                <a
                  href={`/projects/${project.id}`}
                  className="mt-4 inline-block rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white"
                >
                  Open project
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
