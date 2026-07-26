import { MongoClient } from 'mongodb'

let clientPromise

export async function getDb() {
  if (!clientPromise) {
    const client = new MongoClient(process.env.MONGO_URL)
    clientPromise = client.connect()
  }
  const client = await clientPromise
  return client.db(process.env.DB_NAME)
}
