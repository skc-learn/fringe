export default () => {
  const { data, isError, refetch } = useQuery({ queryKey: ['items'], queryFn: () => fetch('/api/items') });
  const retry = refetch;
  return isError ? <p>Couldn't load the list. <button onClick={retry}>Try again</button></p> : <ul>{data?.map((i) => <li key={i.id}>{i.name}</li>)}</ul>;
};
