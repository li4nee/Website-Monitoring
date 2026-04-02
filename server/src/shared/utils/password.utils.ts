import bcrypt from "bcrypt";
export class PasswordUtils {
   /**
    *
    * @param {string }password
    * @returns {boolean} true if the password is valid, false otherwise
    */
   static validateUserPasswordInput(password: string): boolean {
      if (password.length < 8) return false;
      // At least one uppercase letter, one lowercase letter, one number, and one special character
      return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(password);
   }

   /**
    * Hash the password using bcrypt
    * @param password
    * @returns {Promise<string>} the hashed password
    */
   static async hashPassword(password: string): Promise<string> {
      const saltRounds = 10;
      return await bcrypt.hash(password, saltRounds);
   }

   /**
    *
    * @param password
    * @param hash
    * @returns {Promise<boolean>} true if the password matches the hash, false otherwise
    */
   static async comparePassword(password: string, hash: string): Promise<boolean> {
      return await bcrypt.compare(password, hash);
   }
}
