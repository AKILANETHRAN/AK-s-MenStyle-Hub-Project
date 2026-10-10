# MongoDB Compass setup

The application keeps SQLite as its source of truth and mirrors products, users,
and orders to MongoDB for inspection in MongoDB Compass.

## Local MongoDB

1. Install and start MongoDB Community Server.
2. Open `stylehub/stylehub-backend/.env`.
3. Add:

   ```dotenv
   MONGODB_URI=mongodb://127.0.0.1:27017
   MONGODB_DB_NAME=stylehub
   MONGODB_SYNC_INTERVAL_MS=30000
   ```

4. Start the backend:

   ```powershell
   cd stylehub\stylehub-backend
   npm start
   ```

5. In MongoDB Compass, connect to `mongodb://127.0.0.1:27017` and open the
   `stylehub` database. The `products`, `users`, and `orders` collections are
   refreshed when the backend starts and every 30 seconds.

The `/health` endpoint reports `MONGODB_CONNECTED`, `MONGODB_UNAVAILABLE`, or
`MONGODB_NOT_CONFIGURED` in its `mongodb` field.

The mirrored records can also be read through:

```text
GET http://localhost:5000/api/users/:id
GET http://localhost:5000/api/orders/:id
```

These are read-only inspection endpoints. The main application continues to
write to SQLite, and the mirror refreshes every 30 seconds.

## MongoDB Atlas

Use the connection string from Atlas instead of the local URI. Keep the URI in
`.env` and do not commit it. In Atlas, add the backend machine's IP address to
the network access list and create a database user with access to the
`stylehub` database.

Password hashes are not copied to the MongoDB `users` collection.
