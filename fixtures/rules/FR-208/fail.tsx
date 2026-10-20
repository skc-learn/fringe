const { data } = useQuery(['u'], fetchUser);
export default () => <List items={data} />;
