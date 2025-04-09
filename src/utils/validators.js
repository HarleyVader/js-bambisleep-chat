export const validateUser = (user) => {
  const errors = {};
  if (!user.username || user.username.trim() === '') {
    errors.username = 'Username is required';
  }
  if (!user.email || !/\S+@\S+\.\S+/.test(user.email)) {
    errors.email = 'Valid email is required';
  }
  if (!user.password || user.password.length < 6) {
    errors.password = 'Password must be at least 6 characters long';
  }
  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

export const validateMessage = (message) => {
  const errors = {};
  if (!message.content || message.content.trim() === '') {
    errors.content = 'Message content is required';
  }
  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};