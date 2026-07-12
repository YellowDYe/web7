import React, { useState } from 'react';
import AuthForm from '../components/auth/AuthForm';

const Auth: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);

  return (
    <AuthForm 
      isLogin={isLogin} 
      onToggle={() => setIsLogin(!isLogin)} 
    />
  );
};

export default Auth;