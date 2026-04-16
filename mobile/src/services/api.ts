import axios from 'axios';

export const mobileApi = axios.create({
  baseURL: process.env.MOBILE_API_BASE_URL ?? 'http://localhost:4000',
});
