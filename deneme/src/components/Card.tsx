import React from 'react';
import { motion } from 'framer-motion';

const Card = ({ title, description }) => {
  return (
    <motion.div className="bg-white shadow-md hover:shadow-lg transition-shadow">
      <div className="p-4">
        <h2 className="text-xl font-bold">{title}</h2>
        <p>{description}</p>
      </div>
    </motion.div>
  );
};

export default Card;
