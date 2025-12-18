const express = require("express");
const app = express();
require("dotenv").config();
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 3000;
const stripe = require("stripe")(process.env.STRIPE_SECRET);
const crypto = require("crypto");

const admin = require("firebase-admin");

// const serviceAccount = require("./firebase-admin-key.json");

const decoded = Buffer.from(process.env.FB_SERVICE_KEY, "base64").toString(
  "utf8"
);
const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

function generateTrackingId() {
  const prefix = "PRCL";
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = crypto.randomBytes(3).toString("hex").toUpperCase();

  return `${prefix}-${date}-${random}`;
}

app.use(express.json());
app.use(cors());

const verifyFbToken = async (req, res, next) => {
  console.log("header in the middleWare", req.headers.authorization);
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).send({ message: "unauthorizes access" });
  }

  try {
    const idToken = token.split(" ")[1];
    const decoded = await admin.auth().verifyIdToken(idToken);
    console.log("decoded in the token ", decoded);
    req.decoded_email = decoded.email;
    next();
  } catch (err) {
    return res.status(401).send({ message: "unauthorizes access" });
  }
};

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
    // await client.connect();
    const db = client.db("ClubsSphere");
    const membersCollection = db.collection("members");
    const clubManagerRequestsCollection = db.collection("clubManagerRequests");
    const clubRequestsCollection = db.collection("clubRequests");
    const clubsCollection = db.collection("clubs");
    const paymentCollection = db.collection("payments");
    const eventsCollection = db.collection("events");
    const eventRegistrationsCollection = db.collection("eventResgistrations");
    app.post("/create-checkout-session", async (req, res) => {
      const paymentInfo = req.body;

      const amount = parseInt(paymentInfo.monthlyCharge) * 100;
      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: "USD",
              unit_amount: amount,
              product_data: {
                name: paymentInfo.clubName,
              },
            },

            quantity: 1,
          },
        ],
        customer_email: paymentInfo.email,
        metadata: {
          clubId: paymentInfo.clubId,
          ClubName: paymentInfo.clubName,
          managerEmail: paymentInfo.managerEmail,
        },
        mode: "payment",

        success_url: `${process.env.SIDE_DOMAIN}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.SIDE_DOMAIN}/payment-cancelled`,
      });

      res.send({ url: session.url });
    });

    // event related api

    app.post("/events", async (req, res) => {
      try {
        const {
          clubId,
          clubName,

          title,
          description,
          eventDate,
          location,
          maxAttendees,
          imageUrl,
          createdBy,
        } = req.body;

        if (!clubId || !title || !eventDate || !location || !createdBy) {
          return res.status(400).send({ message: "Required fields missing" });
        }

        const event = {
          clubId: new ObjectId(clubId),
          title,
          description: description || "",
          eventDate: new Date(eventDate),
          location,
          clubName: clubName || "",
          maxAttendees: maxAttendees || null,
          imageUrl: imageUrl || null,
          status: "published",
          createdBy,
          createdAt: new Date(),
        };

        const result = await eventsCollection.insertOne(event);
        res.send(result);
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    // GET all events
    app.get("/events", async (req, res) => {
      try {
        const events = await eventsCollection.find().toArray();
        res.send(events);
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Failed to fetch events" });
      }
    });

    app.post("/event-registration", verifyFbToken, async (req, res) => {
      const { eventId, userEmail } = req.body;
      const event = await eventsCollection.findOne({
        _id: new ObjectId(eventId),
        status: "published",
      });
      if (!event) return res.status(404).send({ message: "Event not found" });

      const clubMember = await paymentCollection.findOne({
        customerEmail: userEmail,
      });
      if (!clubMember) {
        return res
          .status(403)
          .send({ message: "you must join the Club first" });
      }

      const alreadyRegistered = await eventRegistrationsCollection.findOne({
        eventId,
        userEmail,
      });
      if (alreadyRegistered) {
        return res
          .status(409)
          .send({ message: "You are already registered for this event" });
      }

      const registration = {
        eventId,
        userEmail,
        clubId: event.clubId,
        status: "registered",
        registeredAt: new Date(),
      };
      const result = await eventRegistrationsCollection.insertOne(registration);
      res.send(result);
    });

    app.patch("/payment-success", verifyFbToken, async (req, res) => {
      const sessionId = req.query.session_id;
      console.log("session id", sessionId);
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      const trackingId = generateTrackingId();

      const transactionId = session.payment_intent;
      const query = { transactionId: transactionId };
      const paymentExist = await paymentCollection.findOne(query);
      if (paymentExist) {
        return res.send({ message: "already exists", transactionId });
      }

      if (session.payment_status === "paid") {
        const id = session.metadata.clubId;
        const query = { _id: new ObjectId(id) };
        const update = {
          $set: {
            // clubRole: "club-member",
            // paymentStatus: "paid",
            // trackingId: trackingId,
          },
        };
        const result = await clubsCollection.updateOne(query, update);
        console.log(result);
      }

      const payment = {
        amount: session.amount_total / 100,
        currency: session.currency,
        customerEmail: session.customer_email,
        clubId: session.metadata.clubId,
        clubName: session.metadata.clubName,
        transactionId: session.payment_intent,
        paymemtStatus: session.payment_status,

        trackingId: trackingId,
        paidAt: new Date(),
        managerEmail: session.metadata.managerEmail,
      };
      if (session.payment_status === "paid") {
        const resultPayment = await paymentCollection.insertOne(payment);

        res.send({
          success: true,
          modifyParcel: result,
          trackingId: trackingId,
          paymentInfo: resultPayment,
          transactionId: session.payment_intent,
        });
      }

      res.send({ success: true });
    });

    // customer get api

    app.get("/customer-email/:email", verifyFbToken, async (req, res) => {
      const email = req.params.email;

      const myClub = await paymentCollection
        .find({ customerEmail: email })
        .toArray();

      res.send(myClub);
    });
    app.get("/event-register-email/:email", verifyFbToken, async (req, res) => {
      const email = req.params.email;

      const myClub = await eventRegistrationsCollection
        .find({ userEmail: email })
        .toArray();

      res.send(myClub);
    });
    app.get("/email/:email", verifyFbToken, async (req, res) => {
      const email = req.params.email;

      const myClub = await clubsCollection.find({ email: email }).toArray();

      res.send(myClub);
    });
    app.get("/club-memberss", async (req, res) => {
      const allClubs = await clubsCollection.find().toArray();

      res.send(allClubs);
    });
    app.get("/club-eventss", async (req, res) => {
      const allEvents = await eventsCollection.find().toArray();

      res.send(allEvents);
    });
    app.get("/all-clubss", async (req, res) => {
      const clubMembers = await paymentCollection.find().toArray();

      res.send(clubMembers);
    });

    app.post("/club-requests", async (req, res) => {
      const clubData = req.body;

      if (
        clubData.monthlyCharge == undefined ||
        isNaN(parseFloat(clubData.monthlyCharge))
      ) {
        return res.status(400).send({
          message: "Monthly charge is required and must be a number.",
        });
      }

      clubData.monthlyCharge = parseFloat(clubData.monthlyCharge);

      clubData.status = "pending";
      clubData.submittedAt = new Date();

      const existingPending = await clubRequestsCollection.findOne({
        managerEmail: clubData.email,
        status: "pending",
      });

      if (existingPending) {
        return res
          .status(400)
          .send({ message: "You already have a pending club request." });
      }

      const result = await clubRequestsCollection.insertOne(clubData);
      res.send(result);
    });

    app.get("/club-members", async (req, res) => {
      const managerEmail = req.query.email;

      const clubs = await clubsCollection
        .find({ email: managerEmail })
        .toArray();

      const clubIds = clubs.map((c) => c._id.toString());

      const members = await paymentCollection
        .find({
          clubId: { $in: clubIds },
          paymemtStatus: "paid",
        })
        .toArray();

      res.send(members);
    });

    app.get("/club-requests", async (req, res) => {
      const query = { status: "pending" };
      const result = await clubRequestsCollection.find(query).toArray();
      res.send(result);
    });

    app.patch("/club-requests/approve/:id", async (req, res) => {
      const id = req.params.id;

      try {
        const clubRequest = await clubRequestsCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!clubRequest) {
          return res.status(404).send({ message: "Request not found" });
        }

        const { _id, status, submittedAt, ...finalClubData } = clubRequest;

        finalClubData.isPublished = true;
        finalClubData.approvedAt = new Date();

        const insertResult = await clubsCollection.insertOne(finalClubData);

        const updateResult = await clubRequestsCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              status: "approved",
              publishedClubId: insertResult.insertedId,
            },
          }
        );

        if (updateResult.modifiedCount === 0 && updateResult.matchedCount > 0) {
          console.warn(
            `Club request ${id} was found but status update did not modify any document.`
          );
        }

        res.send({ message: "Club Approved and Published Successfully!" });
      } catch (error) {
        console.error("Error approving club:", error);
        res
          .status(500)
          .send({ message: "An error occurred during approval process." });
      }
    });
    // reject;
    // app.patch("/club-manager-request/reject/:id", async (req, res) => {
    //   const id = req.params.id;
    //   try {
    //     const filter = { _id: new ObjectId(id) };
    //     const updateDoc = {
    //       $set: {
    //         status: "rejected",
    //         rejectedAt: new Date(),
    //       },
    //     };

    //     const result = await clubRequestsCollection.updateOne(
    //       filter,
    //       updateDoc
    //     );

    //     if (result.matchedCount === 0) {
    //       return res.status(404).send({ message: "Request not found" });
    //     }

    //     res.send({ message: "This request has been rejected." });
    //   } catch (error) {
    //     console.error("Error rejecting request:", error);
    //     res.status(500).send({ message: "Internal server error" });
    //   }
    // });

    app.patch("/club-manager-request/reject/:id", async (req, res) => {
      const id = req.params.id;

      try {
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            status: "rejected",
            rejectedAt: new Date(),
          },
        };

        const result = await clubManagerRequestsCollection.updateOne(
          filter,
          updateDoc
        );

        if (result.matchedCount === 0) {
          return res.status(404).send({ message: "Request not found" });
        }

        res.send({ message: "This request has been rejected." });
      } catch (error) {
        console.error("Error rejecting request:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    app.get("/clubs", async (req, res) => {
      const result = await clubsCollection.find().toArray();
      res.send(result);
    });

    app.get("/clubs/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const club = await clubsCollection.findOne(query);

      if (club) {
        res.send(club);
      } else {
        res.status(404).send({ message: "club not found" });
      }
    });

    app.get("clubs/:id", async (req, res) => {
      const id = req.params.id;
      const clubId = new ObjectId(id);
      const query = { _id: clubId };
      const club = await clubsCollection.findOne(query);
      if (club) {
        res.send(club);
      } else {
        res.status(404).send({ message: "club not found" });
      }
    });

    app.get("/users/:email/role", verifyFbToken, async (req, res) => {
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

    app.post("/club-manager-request", verifyFbToken, async (req, res) => {
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
      const result = await clubManagerRequestsCollection.find().toArray();
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
    // chart related api

    app.get("/total-revenue", async (req, res) => {
      try {
        const totalRevenueResult = await paymentCollection
          .aggregate([
            {
              $match: {
                paymemtStatus: "paid",
              },
            },
            {
              $group: {
                _id: null,
                totalRevenue: { $sum: "$amount" },
              },
            },
            {
              $project: {
                _id: 0,
                totalRevenue: 1,
              },
            },
          ])
          .toArray();

        const totalRevenue =
          totalRevenueResult.length > 0
            ? totalRevenueResult[0].totalRevenue
            : 0;

        res.send({
          success: true,
          totalRevenue: totalRevenue,
          message: "Total revenue fetched successfully.",
        });
      } catch (error) {
        console.error("Error fetching total revenue:", error);
        res.status(500).send({
          success: false,
          message: "Failed to fetch total revenue.",
          error: error.message,
        });
      }
    });

    app.patch("/club-manager-request/make-admin/:id", async (req, res) => {
      const id = req.params.id;

      try {
        const managerRequest = await clubManagerRequestsCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!managerRequest) {
          return res.status(404).send({ message: "Request not found" });
        }

        if (managerRequest.status !== "approved") {
          return res.status(400).send({
            message: "Only approved managers can be promoted to Admin.",
          });
        }

        const updateResult = await membersCollection.updateOne(
          { email: managerRequest.email },
          { $set: { role: "admin" } }
        );

        if (updateResult.matchedCount === 0) {
          return res
            .status(404)
            .send({ message: "Member not found to promote as admin." });
        }

        res.send({ message: "Manager has been promoted to Admin ✅" });
      } catch (err) {
        console.error("Error promoting manager to admin:", err);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    app.get("/admin-stats", async (req, res) => {
      if (!paymentCollection || !membersCollection) {
        return res
          .status(503)
          .send({ message: "Database collections not initialized." });
      }

      try {
        const revenueResult = await paymentCollection
          .aggregate([
            { $match: { paymemtStatus: "paid" } },
            { $group: { _id: null, totalRevenue: { $sum: "$amount" } } },
          ])
          .toArray();

        const totalRevenue =
          revenueResult.length > 0 ? revenueResult[0].totalRevenue : 0;

        const clubRevenueData = await paymentCollection
          .aggregate([
            { $match: { paymemtStatus: "paid" } },
            {
              $group: {
                _id: { $ifNull: ["$clubName", "Unassigned Club"] },
                totalRevenue: { $sum: "$amount" },
              },
            },
            { $project: { _id: 0, clubName: "$_id", total: "$totalRevenue" } },
          ])
          .toArray();

        const clubMemberData = await membersCollection
          .aggregate([
            { $match: { clubName: { $exists: true, $ne: null } } },
            {
              $group: {
                _id: "$clubName",
                totalMembers: { $sum: 1 },
              },
            },
            {
              $project: { _id: 0, clubName: "$_id", members: "$totalMembers" },
            },
          ])
          .toArray();

        const totalMembers = await membersCollection.estimatedDocumentCount();

        const finalChartData = clubRevenueData.map((revenueItem) => {
          const matchingMemberData = clubMemberData.find(
            (memberItem) => memberItem.clubName === revenueItem.clubName
          );
          return {
            ...revenueItem,
            members: matchingMemberData ? matchingMemberData.members : 0,
          };
        });

        res.send({
          success: true,
          totalRevenue: totalRevenue,
          totalMembers: totalMembers,
          clubRevenueData: finalChartData,
          message: "All admin statistics fetched successfully in one go.",
        });
      } catch (error) {
        console.error("Error fetching admin stats:", error);
        res.status(500).send({
          success: false,
          message: "Failed to fetch admin statistics.",
          error: error.message,
        });
      }
    });
    // await client.connect();

    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
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
