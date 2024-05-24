const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
require('dotenv').config();
const {
  MongoClient,
  ServerApiVersion,
  ObjectId
} = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://genius-workplace.web.app',
    'https://genius-workplace.firebaseapp.com'
  ],
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// mongodb

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.nss4adm.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});


// token maddleware
const logger = (req, res, next) => {
  next();
}

const verifyToken = (req, res, next) => {
  const token = req?.cookies?.token;
  if (!token) {
    return res.status(401).send({
      message: 'Unauthorized access'
    })
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRECT, (err, decoded) => {
    if (err) {
      return res.status(401).send({
        message: 'unauthorized access'
      })
    }
    req.user = decoded;
    next();
  })

}

async function run() {
  try {
    // await client.connect();

    const jobCollections = client.db('geniuesWorkPlace').collection('jobs')
    const applyCollections = client.db('geniuesWorkPlace').collection('applies')

    // auth related api
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRECT, {
        expiresIn: '12h'
      });

      res.cookie('token', token, {
          httpOnly: true,
          secure: true,
          sameSite: 'none'
        })
        .send({
          success: true
        });
    })

    app.post('/logout', async (req, res) => {
      const user = req.body;
      res.clearCookie('token', {
        maxAge: 0
      }).send({
        success: true
      })
    })

    // add job in database
    app.post('/add-job', async (req, res) => {
      const job = req.body;
      const result = await jobCollections.insertOne(job);
      res.send(result);
    })

    // get Job from database
    app.get('/all-jobs', async (req, res) => {
      const cursor = jobCollections.find();
      const result = await cursor.toArray();
      res.send(result);
    })

    // search api for all jobs
    app.get('/job-search', async (req, res) => {
      const search = req.query.search;
      let query = {
        jobTitle: {
          $regex: `${search}`,
          $options: 'i'
        }
      }
      const result = await jobCollections.find(query).toArray();
      res.send(result)
    })

    // job details
    app.get('/job-details/:id', async (req, res) => {
      const id = req.params.id;
      const query = {
        _id: new ObjectId(id)
      };
      const result = await jobCollections.findOne(query);
      res.send(result)
    })

    // get jobs for each user
    app.get('/all-jobs/:email', logger, verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = {
        'emplyoer.email': email
      }
      const result = await jobCollections.find(query).toArray();
      res.send(result)
    })


    // job update api
    app.put('/update-job/:id', async (req, res) => {
      const id = req.params.id;      
      const filter = {
        _id: new ObjectId(id)
      }
      const options = {
        upsert: true
      }
      const updateJob = req.body;
      const job = {
        $set: {
          jobBanner: updateJob.jobBanner,
          jobTitle: updateJob.jobTitle,
          jobCategory: updateJob.jobCategory,
          minSalary: updateJob.minSalary,
          maxSalary: updateJob.maxSalary,
          deadline: updateJob.deadline,
          jobDescription: updateJob.jobDescription,
        }
      }
      const result = await jobCollections.updateOne(filter, job, options)
      res.send(result);
    })

    // job apply store in DB
    app.post('/applies', async (req, res) => {
      const apply = req.body;
        // checking duplicate applied
      const query = {
        applicantEmail : apply.applicantEmail,
        jobId : apply.jobId
      }
      const alreadyApplied = await applyCollections.findOne(query);     
      if (alreadyApplied) {
        return res
          .status(400)
          .send('You have already applied on this job.')
      }      
      const result = await applyCollections.insertOne(apply);
        // appliedCount Upadte
      const updateApplied = {
        $inc : {applied_count: 1}
      }
      // const id = req.applyData.
      const jobQuery = {_id : new ObjectId(apply.jobId)}
      const updateTotalApplicant = await jobCollections.updateOne(jobQuery, updateApplied)   
      res.send(result)
    })

    // applied jobs get for user
    app.get('/applied-jobs/:email', logger, verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = {
        applicantEmail: email
      }
      const result = await applyCollections.find(query).toArray();
      res.send(result)
    })

    // delete job data
    app.delete('/all-jobs/:id', async (req, res) => {
      const id = req.params.id;
      const query = {
        _id: new ObjectId(id)
      }
      const result = await jobCollections.deleteOne(query);
      res.send(result);
    })

    // Send a ping to confirm a successful connection
    await client.db("admin").command({
      ping: 1
    });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

// server
app.get('/', (req, res) => {
  res.send('Genies Work Place server is running.')
})

app.listen(port, () => {
  console.log(`Genius Work Place server is running on ${port}`);
})