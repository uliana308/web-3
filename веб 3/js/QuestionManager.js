// Мемы идут «колодой»: пока не покажутся все, ни один не повторится.
class QuestionManager {
  constructor(memes) {
    this.memes = memes;
    this.reset();
  }

  reset() {
    this.deck = [];
    this.last = null;
  }

  next() {
    if (this.deck.length === 0) {
      this.deck = shuffle(this.memes);
      if (this.deck[this.deck.length - 1] === this.last) this.deck.reverse();
    }
    const meme = this.deck.pop();
    this.last = meme;

    const wrong = shuffle(meme.decoys).slice(0, 2);
    const correctLane = randInt(3);
    const options = wrong.slice();
    options.splice(correctLane, 0, meme.caption);

    return { image: meme.image, caption: meme.caption, options, correctLane };
  }
}
