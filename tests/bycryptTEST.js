import bcrypt from 'bcrypt';

async function generateHash(inputString) {
    const saltRounds = 10; // Standard speed/security balance
    
    // Generates salt and hashes the input string
    const hash = await bcrypt.hash(inputString, saltRounds);
    
    console.log(`Original String: ${inputString}`);
    console.log(`Bcrypt Hash:     ${hash}`);
}

// Replace 'password' with any string you want to hash
generateHash('password');
