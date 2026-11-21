export type GraphqlVariables = Record<string, string>;

export interface GithubApi {
  executeApi(document: string, variables: GraphqlVariables): Promise<unknown>;
}
