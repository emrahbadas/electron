// Express app setup
import express from 'express';
const app = express();
app.get('/api/todos', (req, res) => { /* ... */ });
app.listen(3000, () => console.log('Server running on port 3000'));