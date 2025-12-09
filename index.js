const express = require("express");
const app = express();
require("dotenv").config();
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());
const uri = `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASS}@cluster0.9a0hyyx.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    const db = client.db("ClubsSphere");
    const membersCollection = db.collection("members");
    const clubManagerRequestsCollection = db.collection("clubManagerRequests");
    const clubRequestsCollection = db.collection("clubRequests");

    app.post("/club-requests", async (req, res) => {
      const clubData = req.body;
      clubData.status = "pending";
      clubData.submittedAt = new Date();
      const existingPending = await clubRequestsCollection.findOne({
        managerEmail: clubData.email,
        status: "pending",
      });
      if (existingPending) {
        return res
          .status(404)
          .send({ message: "You already have a pending club" });
      }
      const result = await clubRequestsCollection.insertOne(clubData);
      res.send(result);
    });

    app.get("club-requests", async (req, res) => {
      const query = { status: "pending" };
      const result = await clubRequestsCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/users/:email/role", async (req, res) => {
      const email = req.params.email;

      const user = await membersCollection.findOne({ email: email });

      if (user) {
        res.send({ role: user.role });
      } else {
        res.status(404).send({ role: "member" });
      }
    });

    // user post api
    app.post("/users", async (req, res) => {
      const member = req.body;
      member.role = "member";
      member.createdAt = new Date();

      const result = await membersCollection.insertOne(member);
      res.send(result);
    });

    // club manager post request api

    app.post("/club-manager-request", async (req, res) => {
      const requestData = req.body;
      requestData.status = "pending";
      requestData.createdAt = new Date();

      const existing = await clubManagerRequestsCollection.findOne({
        email: requestData.email,
        status: "pending",
      });

      if (existing)
        return res.send({ message: "Already requested", inserted: false });

      const result = await clubManagerRequestsCollection.insertOne(requestData);
      res.send(result);
    });

    // ✅ Admin: Get all club manager requests
    app.get("/club-manager-requests", async (req, res) => {
      const result = await clubManagerRequestsCollection
        .find({ createdAt: -1 })
        .toArray();
      res.send(result);
    });

    app.patch("/club-manager-request/approve/:id", async (req, res) => {
      const id = req.params.id;
      try {
        // 1. Update status
        const requestUpdate = await clubManagerRequestsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status: "approved" } }
        );

        // 2. Get approved request
        const approvedRequest = await clubManagerRequestsCollection.findOne({
          _id: new ObjectId(id),
        });

        // 3. Update member role
        await membersCollection.updateOne(
          { email: approvedRequest.email },
          { $set: { role: "manager" } }
        );

        res.send({ message: "User is now a Manager ✅" });
      } catch (err) {
        console.error(err);
        res.status(500).send({ error: "Something went wrong" });
      }
    });
    await client.connect();

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}
run().catch(console.dir);
app.get("/", (req, res) => {
  res.send("Hello Worlds!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
