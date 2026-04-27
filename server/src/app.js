import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config({
    path: './.env'
});

const app = express();
app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
}))
app.use(express.json());


app.get('/', (req, res) => {
  res.send('server is running');
});

const PORT = process.env.PORT ;

console.log('PORT', PORT)
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
})


export default app;
