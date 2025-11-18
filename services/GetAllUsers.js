
import express from 'express';


const port = process.env.PORT || 5000;
const app = express();

const users = {
    "name" : "Ricardo",
    "email" : "ricardo@ricardo.com",
    "phone" : "1234567890",
    "role" : "User"
};

app.get("/getAllUsers", async (req, res) => {
    res.json(users);
})


app.listen(port, () => {
    console.log(`🚀 Servidor corriendo en puerto ${port}`);
})