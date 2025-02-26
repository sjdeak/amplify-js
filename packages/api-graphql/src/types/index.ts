// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { AmplifyClassV6, ResourcesConfig } from '@aws-amplify/core';
import {
	EnumTypes,
	ModelTypes,
	CustomHeaders,
	CustomQueries,
	CustomMutations,
} from '@aws-amplify/data-schema-types';
import { Source, DocumentNode, GraphQLError } from 'graphql';
export { OperationTypeNode } from 'graphql';
import { Observable } from 'rxjs';

import {
	GraphQLAuthMode,
	DocumentType,
} from '@aws-amplify/core/internals/utils';
import { AmplifyServer } from '@aws-amplify/core/internals/adapter-core';

export { CONTROL_MSG, ConnectionState } from './PubSub';

export { SelectionSet } from '@aws-amplify/data-schema-types';

export { CommonPublicClientOptions } from '../internals/types';

/**
 * Loose/Unknown options for raw GraphQLAPICategory `graphql()`.
 */
export interface GraphQLOptions {
	query: string | DocumentNode;
	variables?: Record<string, DocumentType>;
	authMode?: GraphQLAuthMode;
	authToken?: string;
	/**
	 * @deprecated This property should not be used
	 */
	userAgentSuffix?: string;
}

export interface GraphQLResult<T = object> {
	data: T;
	errors?: GraphQLError[];
	extensions?: {
		[key: string]: any;
	};
}

// Opaque type used for determining the graphql query type
declare const queryType: unique symbol;

export type GraphQLQuery<T> = T & { readonly [queryType]: 'query' };
export type GraphQLSubscription<T> = T & {
	readonly [queryType]: 'subscription';
};

/**
 * Accepts a code generated model type and returns a supertype that
 * can accept return values from the relevant graphql operations.
 *
 * For example:
 *
 * ```typescript
 * import { GraphQLReturnType } from 'aws-amplify/api';
 * import { MyModel } from './API';
 * import { getMyModel } from './graphql/queries';
 *
 * const [item, setItem] = useState<GraphQLReturnType<MyModel>>();
 * setItem(await client.graphql({ query: getMyModel }).data.getMyModel!)
 * ```
 *
 * Trying to assign the result of a `getMyModel` operation directly to a
 * `MyModel` variables won't necessarily work, because normally-required related
 * models might not be part of the selection set.
 *
 * This util simply makes related model properties optional recursively.
 */
export type GraphQLReturnType<T> = T extends {}
	? {
			[K in keyof T]?: GraphQLReturnType<T[K]>;
		}
	: T;

/**
 * Describes a paged list result from AppSync, which can either
 * live at the top query or property (e.g., related model) level.
 */
type PagedList<T, TYPENAME> = {
	__typename: TYPENAME;
	nextToken?: string | null | undefined;
	items: Array<T>;
};

/**
 * Recursively looks through a result type and removes nulls and
 * and undefined from `PagedList` types.
 *
 * Although a graphql response might contain empty values in an
 * array, this will only be the case when we also have errors,
 * which will then be *thrown*.
 */
type WithListsFixed<T> =
	T extends PagedList<infer IT, infer NAME>
		? PagedList<Exclude<IT, null | undefined>, NAME>
		: T extends {}
			? {
					[K in keyof T]: WithListsFixed<T[K]>;
				}
			: T;

/**
 * Returns an updated response type to always return a value.
 */
type NeverEmpty<T> = {
	[K in keyof T]-?: Exclude<WithListsFixed<T[K]>, undefined | null>;
};

/**
 * Replaces all list result types in a query result with types to exclude
 * nulls and undefined from list member unions.
 *
 * If empty members are present, there will also be errors present,
 * and the response will instead be *thrown*.
 */
type FixedQueryResult<T> =
	Exclude<T[keyof T], null | undefined> extends PagedList<any, any>
		? {
				[K in keyof T]-?: WithListsFixed<Exclude<T[K], null | undefined>>;
			}
		: T;

/**
 * The return value from a `graphql({query})` call when `query` is a subscription.
 *
 * ```ts
 * //               |-- You are here
 * //               v
 * const subResult: GraphqlSubscriptionResult<T> = client.graphql({
 * 	query: onCreateWidget
 * });
 *
 * const sub = subResult.subscribe({
 * 	//
 * 	//            |-- You are here
 * 	//            v
 * 	next(message: GraphqlSubscriptionMessage<OnCreateWidgetSubscription>) {
 * 		handle(message.value);  // <-- type OnCreateWidgetSubscription
 * 	}
 * })
 * ```
 */
export type GraphqlSubscriptionResult<T> = Observable<
	GraphqlSubscriptionMessage<T>
>;

/**
 * The shape of messages passed to `next()` from a graphql subscription. E.g.,
 *
 * ```ts
 * const sub = client.graphql({
 * 	query: onCreateWidget,
 * }).subscribe({
 * 	//
 * 	//            |-- You are here
 * 	//            v
 * 	next(message: GraphqlSubscriptionMessage<OnCreateWidgetSubscription>) {
 * 		handle(message.value);  // <-- type OnCreateWidgetSubscription
 * 	}
 * })
 * ```
 */
export type GraphqlSubscriptionMessage<T> = {
	data: T;
};

export interface AWSAppSyncRealTimeProviderOptions {
	appSyncGraphqlEndpoint?: string;
	authenticationType?: GraphQLAuthMode;
	query?: string;
	variables?: Record<string, unknown>;
	apiKey?: string;
	region?: string;
	libraryConfigHeaders?: () => {} | (() => Promise<{}>);
	additionalHeaders?: CustomHeaders;
}

export type AWSAppSyncRealTimeProvider = {
	subscribe(
		options?: AWSAppSyncRealTimeProviderOptions,
	): Observable<Record<string, unknown>>;
};

export enum GraphQLAuthError {
	NO_API_KEY = 'No api-key configured',
	NO_CURRENT_USER = 'No current user',
	NO_CREDENTIALS = 'No credentials',
	NO_FEDERATED_JWT = 'No federated jwt',
	NO_AUTH_TOKEN = 'No auth token specified',
}

/**
 * GraphQLSource or string, the type of the parameter for calling graphql.parse
 * @see: https://graphql.org/graphql-js/language/#parse
 */
export type GraphQLOperation = Source | string;

/**
 * API V6 `graphql({options})` type that can leverage branded graphql `query`
 * objects and fallback types.
 */
export interface GraphQLOptionsV6<
	FALLBACK_TYPES = unknown,
	TYPED_GQL_STRING extends string = string,
> {
	query: TYPED_GQL_STRING | DocumentNode;
	variables?: GraphQLVariablesV6<FALLBACK_TYPES, TYPED_GQL_STRING>;
	authMode?: GraphQLAuthMode;
	authToken?: string;
	/**
	 * @deprecated This property should not be used
	 */
	userAgentSuffix?: string;
}

/**
 * Result type for `graphql()` operations that don't include any specific
 * type information. The result could be either a `Promise` or `Subscription`.
 *
 * Invoking code should either cast the result or use `?` and `!` operators to
 * navigate the result objects.
 */
export type UnknownGraphQLResponse =
	| Promise<GraphQLResult<any>>
	| GraphqlSubscriptionResult<any>;

/**
 * The expected type for `variables` in a V6 `graphql()` operation with
 * respect to the given `FALLBACK_TYPES` and `TYPED_GQL_STRING`.
 */
export type GraphQLVariablesV6<
	FALLBACK_TYPES = unknown,
	TYPED_GQL_STRING extends string = string,
> =
	TYPED_GQL_STRING extends GeneratedQuery<infer IN, any>
		? IN
		: TYPED_GQL_STRING extends GeneratedMutation<infer IN, any>
			? IN
			: TYPED_GQL_STRING extends GeneratedSubscription<infer IN, any>
				? IN
				: FALLBACK_TYPES extends GraphQLOperationType<infer IN, any>
					? IN
					: any;

/**
 * The expected return type with respect to the given `FALLBACK_TYPE`
 * and `TYPED_GQL_STRING`.
 */
export type GraphQLResponseV6<
	FALLBACK_TYPE = unknown,
	TYPED_GQL_STRING extends string = string,
> =
	TYPED_GQL_STRING extends GeneratedQuery<infer IN, infer QUERY_OUT>
		? Promise<GraphQLResult<FixedQueryResult<QUERY_OUT>>>
		: TYPED_GQL_STRING extends GeneratedMutation<infer IN, infer MUTATION_OUT>
			? Promise<GraphQLResult<NeverEmpty<MUTATION_OUT>>>
			: TYPED_GQL_STRING extends GeneratedSubscription<infer IN, infer SUB_OUT>
				? GraphqlSubscriptionResult<NeverEmpty<SUB_OUT>>
				: FALLBACK_TYPE extends GraphQLQuery<infer T>
					? Promise<GraphQLResult<FALLBACK_TYPE>>
					: FALLBACK_TYPE extends GraphQLSubscription<infer T>
						? GraphqlSubscriptionResult<FALLBACK_TYPE>
						: FALLBACK_TYPE extends GraphQLOperationType<
									infer IN,
									infer CUSTOM_OUT
							  >
							? CUSTOM_OUT
							: UnknownGraphQLResponse;

/**
 * The shape customers can use to provide `T` to `graphql<T>()` to specify both
 * `IN` and `OUT` types (the type of `variables` and the return type, respectively).
 *
 * I.E.,
 *
 * ```ts
 * type MyVariablesType = { ... };
 * type MyResultType = { ... };
 * type MyOperationType = { variables: MyVariablesType, result: MyResultType };
 *
 * const result: MyResultType = graphql<MyOperationType>("graphql string", {
 * 	variables: {
 * 		// MyVariablesType
 * 	}
 * })
 * ```
 */
export type GraphQLOperationType<IN extends {}, OUT extends {}> = {
	variables: IN;
	result: OUT;
};

/**
 * Nominal type for branding generated graphql query operation strings with
 * input and output types.
 *
 * E.g.,
 *
 * ```ts
 * export const getWidget = `...` as GeneratedQuery<
 * 	GetWidgetQueryVariables,
 * 	GetWidgetQuery
 * >;
 * ```
 *
 * This allows `graphql()` to extract `InputType` and `OutputType` to correctly
 * assign types to the `variables` and result objects.
 */
export type GeneratedQuery<InputType, OutputType> = string & {
	__generatedQueryInput: InputType;
	__generatedQueryOutput: OutputType;
};

/**
 * Nominal type for branding generated graphql mutation operation strings with
 * input and output types.
 *
 * E.g.,
 *
 * ```ts
 * export const createWidget = `...` as GeneratedQuery<
 * 	CreateWidgetMutationVariables,
 * 	CreateWidgetMutation
 * >;
 * ```
 *
 * This allows `graphql()` to extract `InputType` and `OutputType` to correctly
 * assign types to the `variables` and result objects.
 */
export type GeneratedMutation<InputType, OutputType> = string & {
	__generatedMutationInput: InputType;
	__generatedMutationOutput: OutputType;
};

/**
 * Nominal type for branding generated graphql mutation operation strings with
 * input and output types.
 *
 * E.g.,
 *
 * ```ts
 * export const createWidget = `...` as GeneratedMutation<
 * 	CreateWidgetMutationVariables,
 * 	CreateWidgetMutation
 * >;
 * ```
 *
 * This allows `graphql()` to extract `InputType` and `OutputType` to correctly
 * assign types to the `variables` and result objects.
 */
export type GeneratedSubscription<InputType, OutputType> = string & {
	__generatedSubscriptionInput: InputType;
	__generatedSubscriptionOutput: OutputType;
};

type FilteredKeys<T> = {
	[P in keyof T]: T[P] extends never ? never : P;
}[keyof T];

type ExcludeNeverFields<O> = {
	[K in FilteredKeys<O>]: O[K];
};

export const __amplify = Symbol('amplify');
export const __authMode = Symbol('authMode');
export const __authToken = Symbol('authToken');
export const __headers = Symbol('headers');

export type ClientWithModels =
	| V6Client<Record<string, any>>
	| V6ClientSSRRequest<Record<string, any>>
	| V6ClientSSRCookies<Record<string, any>>;

export type V6Client<T extends Record<any, any> = never> = ExcludeNeverFields<{
	[__amplify]: AmplifyClassV6;
	[__authMode]?: GraphQLAuthMode;
	[__authToken]?: string;
	[__headers]?: CustomHeaders;
	graphql: GraphQLMethod;
	cancel: (promise: Promise<any>, message?: string) => boolean;
	isCancelError: (error: any) => boolean;
	models: ModelTypes<T>;
	enums: EnumTypes<T>;
	queries: CustomQueries<T>;
	mutations: CustomMutations<T>;
}>;

export type V6ClientSSRRequest<T extends Record<any, any> = never> =
	ExcludeNeverFields<{
		[__amplify]: AmplifyClassV6;
		[__authMode]?: GraphQLAuthMode;
		[__authToken]?: string;
		[__headers]?: CustomHeaders;
		graphql: GraphQLMethodSSR;
		cancel: (promise: Promise<any>, message?: string) => boolean;
		isCancelError: (error: any) => boolean;
		models: ModelTypes<T, 'REQUEST'>;
		enums: EnumTypes<T>;
		queries: CustomQueries<T, 'REQUEST'>;
		mutations: CustomMutations<T, 'REQUEST'>;
	}>;

export type V6ClientSSRCookies<T extends Record<any, any> = never> =
	ExcludeNeverFields<{
		[__amplify]: AmplifyClassV6;
		[__authMode]?: GraphQLAuthMode;
		[__authToken]?: string;
		[__headers]?: CustomHeaders;
		graphql: GraphQLMethod;
		cancel: (promise: Promise<any>, message?: string) => boolean;
		isCancelError: (error: any) => boolean;
		models: ModelTypes<T, 'COOKIES'>;
		enums: EnumTypes<T>;
		queries: CustomQueries<T, 'COOKIES'>;
		mutations: CustomMutations<T, 'COOKIES'>;
	}>;

export type GraphQLMethod = <
	FALLBACK_TYPES = unknown,
	TYPED_GQL_STRING extends string = string,
>(
	options: GraphQLOptionsV6<FALLBACK_TYPES, TYPED_GQL_STRING>,
	additionalHeaders?: CustomHeaders | undefined,
) => GraphQLResponseV6<FALLBACK_TYPES, TYPED_GQL_STRING>;

export type GraphQLMethodSSR = <
	FALLBACK_TYPES = unknown,
	TYPED_GQL_STRING extends string = string,
>(
	contextSpec: AmplifyServer.ContextSpec,
	options: GraphQLOptionsV6<FALLBACK_TYPES, TYPED_GQL_STRING>,
	additionalHeaders?: CustomHeaders | undefined,
) => GraphQLResponseV6<FALLBACK_TYPES, TYPED_GQL_STRING>;

/**
 * @private
 *
 * The knobs available for configuring `server/generateClient` internally.
 */
export type ServerClientGenerationParams = {
	amplify:
		| null // null expected when used with `generateServerClient`
		// closure expected with `generateServerClientUsingCookies`
		| ((fn: (amplify: AmplifyClassV6) => Promise<any>) => Promise<any>);
	// global env-sourced config use for retrieving modelIntro
	config: ResourcesConfig;
};

export type QueryArgs = Record<string, unknown>;

export type ListArgs = {
	selectionSet?: string[];
	filter?: {};
	headers?: CustomHeaders;
};

export type AuthModeParams = {
	authMode?: GraphQLAuthMode;
	authToken?: string;
};

export type GenerateServerClientParams = {
	config: ResourcesConfig;
	authMode?: GraphQLAuthMode;
	authToken?: string;
};
