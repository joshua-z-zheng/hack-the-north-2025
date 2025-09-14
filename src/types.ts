export class Market {
  threshold: number = 0;
  probability: number = 0;
  shares?: number;
}

export class Course {
  code: string = "";
  odds: Market[] = [];

  constructor(code: string) {
    this.code = code;
    this.odds = [
      {
        threshold: 85,
        probability: 0
      },
      {
        threshold: 90,
        probability: 0
      }
    ]
  }
}

export class User {
  email: string = "";
  sub: string = "";
  courses: Course[] = [];
}