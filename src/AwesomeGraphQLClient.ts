// https://github.com/microsoft/TypeScript/issues/15300
/* eslint-disable @typescript-eslint/ban-types */

import { extractFiles } from 'extract-files'
import { DocumentNode } from 'graphql'
import { print } from 'graphql'

import GraphQLRequestError from './GraphQLRequestError'
import isExtractableFileEnhanced from './util/isExtractableFileEnhanced'
import isResponseJSON from './util/isResponseJSON'

export type GraphQLQuery = string | DocumentNode

export default class AwesomeGraphQLClient<
	FetchOptions extends { headers?: any } = RequestInit
> {
	fetch: (url: string, options?: FetchOptions) => Promise<any>
	FormData: any
	endpoint: string
	fetchOptions?: FetchOptions

	constructor(config: {
		/** GraphQL endpoint */
		endpoint: string
		/** Fetch polyfill if necessary */
		fetch?: (url: string, options?: any) => Promise<any>
		/** FormData polyfill if necessary */
		FormData?: any
		/** Overrides for fetch options */
		fetchOptions?: FetchOptions
	}) {
		if (!config.endpoint) {
			throw new Error('endpoint is required')
		}

		if (!config.fetch && typeof fetch === 'undefined') {
			throw new Error(
				'Fetch must be polyfilled or passed in new AwesomeGraphQLClient({ fetch })',
			)
		}

		this.endpoint = config.endpoint
		this.fetch = config.fetch || fetch
		this.fetchOptions = config.fetchOptions
		this.FormData =
			config.FormData || (typeof FormData !== 'undefined' ? FormData : undefined)
	}

	private createRequestBody(query: string, variables?: {}): string | FormData {
		const { clone, files } = extractFiles(
			{ query, variables },
			'',
			isExtractableFileEnhanced,
		)
		const operationJSON = JSON.stringify(clone)

		if (!files.size) {
			return operationJSON
		}

		if (!this.FormData) {
			throw new Error(
				'FormData must be polyfilled or passed in new AwesomeGraphQLClient({ FormData })',
			)
		}

		const form = new this.FormData()

		form.append('operations', operationJSON)

		const map: Record<string, string[]> = {}
		let i = 0
		files.forEach((paths) => {
			map[++i] = paths
		})
		form.append('map', JSON.stringify(map))

		i = 0
		files.forEach((paths, file) => {
			form.append(`${++i}`, file as any)
		})

		return form
	}

	/**
	 * Sets new overrides for fetch options
	 *
	 * @param fetchOptions new overrides for fetch options
	 */
	setFetchOptions(fetchOptions: FetchOptions): void {
		this.fetchOptions = fetchOptions
	}

	/**
	 * Sends GraphQL Request and returns object with 'data' and 'response' fields
	 * or with a single 'error' field.
	 * Notice: this function never throws
	 *
	 * @example
	 * const result = await rawRequest(...)
	 * if ('error' in result) {
	 *   throw result.error
	 * }
	 * console.log(result.data)
	 *
	 * @param query query
	 * @param variables variables
	 * @param fetchOptions overrides for fetch options
	 */
	async rawRequest<TData extends {}, TVariables extends {} = {}>(
		query: GraphQLQuery,
		variables?: TVariables,
		fetchOptions?: FetchOptions,
	): Promise<
		{ data: TData; response: Response } | { error: GraphQLRequestError | Error }
	> {
		try {
			const queryAsString: string = typeof query === 'string' ? query : print(query)

			const body = this.createRequestBody(queryAsString, variables)

			const response: Response = await this.fetch(this.endpoint, {
				...this.fetchOptions,
				...fetchOptions,
				method: 'POST',
				body,
				headers: {
					...this.fetchOptions?.headers,
					...fetchOptions?.headers,
					...(typeof body === 'string' ? { 'Content-Type': 'application/json' } : {}),
				},
			} as any)

			if (!response.ok) {
				if (isResponseJSON(response)) {
					const { errors } = await response.json()

					if (errors?.[0]?.message) {
						throw new GraphQLRequestError({
							query: queryAsString,
							variables,
							response,
							message: errors[0].message,
						})
					}
				}

				throw new GraphQLRequestError({
					query: queryAsString,
					variables,
					response,
					message: `Http Status ${response.status}`,
				})
			}

			const { data, errors } = await response.json()

			if (errors?.[0]) {
				throw new GraphQLRequestError({
					query: queryAsString,
					variables,
					response,
					message: errors[0].message,
				})
			}

			return { data, response }
		} catch (error) {
			return { error }
		}
	}

	/**
	 * Makes GraphQL request and returns data or throws an error
	 *
	 * @example
	 * const data = await request(...)
	 *
	 * @param query query
	 * @param variables variables
	 * @param fetchOptions overrides for fetch options
	 */
	async request<TData extends {}, TVariables extends {} = {}>(
		query: GraphQLQuery,
		variables?: TVariables,
		fetchOptions?: FetchOptions,
	): Promise<TData> {
		const result = await this.rawRequest<TData, TVariables>(
			query,
			variables,
			fetchOptions,
		)

		if ('error' in result) {
			throw result.error
		}

		return result.data
	}
}
