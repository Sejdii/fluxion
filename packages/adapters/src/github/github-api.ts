export type GraphqlVariables = Record<string, string | number>;

export interface GithubApi {
  executeApi(host: string, document: string, variables: GraphqlVariables): Promise<unknown>;
}
