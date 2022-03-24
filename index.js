require('dotenv-yaml').config({path: '.env.yaml'})

const { ApolloServer } = require('apollo-server-express')
const http = require('http')
const express = require('express')
const {
  ApolloServerPluginLandingPageGraphQLPlayground,
  ApolloServerPluginLandingPageDisabled,
  ApolloServerPluginDrainHttpServer,
} = require('apollo-server-core')
const {
  typeDefs: scalarTypeDefs,
  resolvers: scalarResolvers,
} = require('graphql-scalars')
const { ChannexAPI } = require('./channex-ds')
const { resolvers } = require('./resolvers')
const { typeDefs } = require('./types')

if (!process.env.CHANNEX_URL) throw new Error('no CHANNEX_URL')

async function startApolloServer() {
  const app = express()
  const httpServer = http.createServer(app)
  const server = new ApolloServer({
    typeDefs: [typeDefs, ...scalarTypeDefs],
    resolvers: { ...resolvers, ...scalarResolvers },
    dataSources: () => ({
      channexAPI: new ChannexAPI({
        baseURL: process.env.CHANNEX_URL,
      }),
    }),
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      process.env.NODE_ENV === 'production'
        ? ApolloServerPluginLandingPageDisabled()
        : ApolloServerPluginLandingPageGraphQLPlayground(),
    ],
    introspection: process.env.NODE_ENV === 'development',
    context: () => ({ foo: 'bar' }),
  })
  await server.start()
  server.applyMiddleware({ app })
  await new Promise((resolve) => httpServer.listen({ port: 4000 }, resolve))
  // eslint-disable-next-line no-console
  console.log(`🚀 Server ready at http://localhost:4000${server.graphqlPath}`)
}

startApolloServer()
