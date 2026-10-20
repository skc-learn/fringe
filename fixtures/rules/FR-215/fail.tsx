export default () => {
  const { data, isError } = useQuery({ queryKey: ['items'], queryFn: () => fetch('/api/items') });
  return isError ? <p>Something went wrong</p> : <ul>{data?.map((i) => <li key={i.id}>{i.name}</li>)}</ul>;
};
