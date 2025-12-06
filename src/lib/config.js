export const API_ENDPOINT = process.env.NEXT_PUBLIC_API_ENDPOINT;

if (!API_ENDPOINT) {
  throw new Error('NEXT_PUBLIC_API_ENDPOINT is not defined');
}
