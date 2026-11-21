export type GraphqlVariables = Record<string, string | number>;

export interface GithubApi {
  executeApi(document: string, variables: GraphqlVariables): Promise<unknown>;
}
