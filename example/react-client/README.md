# Estuary-RPC Client

Simple demonstration of using estuary-rpc-client within React with typesafe authenticated client and no need to use fetch or manually construct a XmlHttpRequest

# Usage
Can be run like a usual create-react-app with `npm start` alongside the exampleServer in `../server`, however in that situation the WS connections are not proxied correctly. To get that working, simply run `npm build` and then start the exampleServer - it is configured to serve the compiled artifacts of this project