import { signup } from '#controllers/auth.controller.js';
import { Router } from 'express';

const authRouter = Router();

authRouter.post('/sign-up', signup);
authRouter.post('/sign-in', (req, res) => {
  res.send('POST api/v1/auth/sign-in response');
});
authRouter.post('/sign-out', (req, res) => {
  res.send('POST api/v1/auth/sign-out response');
});

export default authRouter;
