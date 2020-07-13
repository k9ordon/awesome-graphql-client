/**
 * @jest-environment node
 */

import { print, DocumentNode } from 'graphql'
import gql from 'graphql-tag'
import FormData from 'form-data'
import { createReadStream } from 'fs'
import fetch from 'node-fetch'
import { join } from 'path'

import { AwesomeGraphQLClient } from '../index'
import { server, rest } from '../jest/server'

const formatQuery = (query: DocumentNode) => print(query)

it('throws if no Fetch polyfill provided', () => {
	expect(() => new AwesomeGraphQLClient({ endpoint: '/' })).toThrow(
		/Fetch must be polyfilled/,
	)
})

it('throws on file upload mutation if no FormData polyfill provided', async () => {
	interface UploadFile {
		uploadFile: boolean
	}
	interface UploadFileVariables {
		file: any
	}

	const client = new AwesomeGraphQLClient({
		endpoint: 'http://localhost:1234/api/graphql',
		fetch,
		formatQuery,
	})

	const query = gql`
		mutation UploadFile($file: Upload!) {
			uploadFile(file: $file)
		}
	`

	await expect(
		client.request<UploadFile, UploadFileVariables>(query, {
			file: createReadStream(join(__dirname, '../index.ts')),
		}),
	).rejects.toThrow(/FormData must be polyfilled/)
})

it('uses provided polyfills', async () => {
	interface UploadFile {
		uploadFile: boolean
	}
	interface UploadFileVariables {
		file: any
	}

	server.use(
		rest.post('http://localhost:1234/api/graphql', (req, res, ctx) =>
			res(ctx.json({ data: { uploadFile: true } })),
		),
	)

	const client = new AwesomeGraphQLClient({
		endpoint: 'http://localhost:1234/api/graphql',
		fetch,
		FormData,
		formatQuery,
	})

	const query = gql`
		mutation UploadFile($file: Upload!) {
			uploadFile(file: $file)
		}
	`

	const data = await client.request<UploadFile, UploadFileVariables>(query, {
		file: createReadStream(join(__dirname, '../index.ts')),
	})

	expect(data).toEqual({ uploadFile: true })
})
