const { data, isLoading, error } = useQuery(['u'], fetchUser);
export default () => isLoading ? <Spinner /> : error ? <p>Something went wrong</p> : data.length === 0 ? <Empty /> : <List items={data} />;
