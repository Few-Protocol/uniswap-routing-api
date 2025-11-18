import axios, { AxiosRequestConfig, AxiosResponse } from 'axios'

import { GraphQLResponse } from './graphql-schemas'

/* Interface for accessing any GraphQL API */
export interface IGraphQLClient {
  fetchData<T>(query: string, variables?: { [key: string]: any }): Promise<T>
}

/* Implementation of the IGraphQLClient interface to give access to any GraphQL API */
export class GraphQLClient implements IGraphQLClient {
  constructor(private readonly endpoint: string, private readonly headers: Record<string, string>) {
    if (!endpoint) {
      throw new Error('GraphQLClient: endpoint is required')
    }
    if (!headers || typeof headers !== 'object') {
      throw new Error('GraphQLClient: headers must be a valid object')
    }
  }

  async fetchData<T>(query: string, variables: { [key: string]: any } = {}): Promise<T> {
    if (!this.endpoint) {
      throw new Error('GraphQLClient: endpoint is not set')
    }
    const requestConfig: AxiosRequestConfig = {
      method: 'POST',
      url: this.endpoint,
      headers: this.headers,
      data: { query, variables },
    }

    try {
      const response: AxiosResponse<GraphQLResponse<T>> = await axios.request(requestConfig)
      const responseBody = response.data
      if (responseBody.errors) {
        throw new Error(`GraphQL error! ${JSON.stringify(responseBody.errors)}`)
      }

      return responseBody.data
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`HTTP error! status: ${error.response?.status}`)
      } else {
        throw new Error(`Unexpected error: ${error}`)
      }
    }
  }
}
