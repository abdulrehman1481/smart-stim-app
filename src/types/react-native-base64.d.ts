declare module 'react-native-base64' {
  export function encode(input: string): string;
  export function decode(input: string): string;
  
  const base64: {
    encode: (input: string) => string;
    decode: (input: string) => string;
  };
  
  export default base64;
}
