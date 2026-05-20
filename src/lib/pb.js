import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_PB_URL)

// Auto-refresh auth token
pb.autoCancellation(false)

export default pb