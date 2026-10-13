/* Labfreak Legends emotes and voice lines (data only). Each class has a line for the six emotes, plus a few
   lines the bots say on their own: at the start, when they play a Legendary, when they're nearly dead, and at the end. */
window.LL_VOICE = {
  emotes: [['greet', 'Greetings'], ['wp', 'Well Played'], ['thanks', 'Thanks'], ['wow', 'Wow'], ['oops', 'Oops'], ['threat', 'Threaten']],
  // speech pitch and rate per class, for the browser's text-to-speech
  tone: { tamer: [1.15, 1.05], gambler: [0.8, 0.95], healer: [1.35, 1.08], collector: [0.95, 0.92], scientist: [1.2, 1.15], champion: [0.7, 0.9], neutral: [1, 1] },
  lines: {
    tamer: {
      greet: 'Hey there! Ready to meet my friends?', wp: 'Well played! Your team fought hard.', thanks: 'Thanks, partner!',
      wow: 'Whoa! Never seen one like that before!', oops: "Uh oh. That wasn't the plan.", threat: 'My team is about to evolve!',
      legend: ['Everybody, say hi to the big one!', 'This one took me three biomes to catch.'], low: ["I'm not out yet! Hang in there, gang!"],
      win: ['Good game! Everyone gets a treat.'], lose: ['Well played. My creatures need a nap.'],
    },
    gambler: {
      greet: 'Pull up a chair, friend.', wp: 'Well played. The house tips its hat.', thanks: 'Much obliged.',
      wow: "Now THAT'S a jackpot!", oops: 'Bad spin. Happens to the best of us.', threat: "Let's raise the stakes.",
      legend: ['Read it and weep.', 'All in.'], low: ['The odds are only mostly against me.'],
      win: ['The house always wins.'], lose: ['Fair game. Next hand is mine.'],
    },
    healer: {
      greet: "Hi! Try not to get hurt, okay?", wp: 'Well played. Truly.', thanks: 'Thank you! Nobody ever says that to me.',
      wow: 'Wow! Do you need a bandage?', oops: "Oops. I'll patch that up.", threat: "I'm about to stop healing you. Wait. I never did.",
      legend: ['Somebody finally showed up to help!', 'Look who decided to join the party.'], low: ["Can somebody heal the healer? Anyone? No?"],
      win: ['See? Nobody had to die. Well, you did.'], lose: ['Well played. I need a long rest.'],
    },
    collector: {
      greet: "Greetings. You'd look lovely on a shelf.", wp: 'Well played. A rare specimen.', thanks: "Thank you. I'll catalogue that.",
      wow: 'Wow. Mint condition!', oops: 'Oops. That one was a duplicate anyway.', threat: 'Every piece goes on my shelf eventually.',
      legend: ['One of a kind. Do not touch.', 'The crown jewel of the collection.'], low: ['Careful! Some of this is irreplaceable!'],
      win: ['Another one for the display case.'], lose: ['Well played. I shall acquire a better deck.'],
    },
    scientist: {
      greet: 'Greetings, test subject!', wp: 'Well played. Fascinating data!', thanks: "Thank you, I'll cite you.",
      wow: 'Wow! The readings are off the charts!', oops: 'Oops. Back to the drawing board.', threat: 'This experiment ends with you.',
      legend: ['Behold! My greatest creation!', 'It lives! IT LIVES!'], low: ['A minor setback in an otherwise flawless plan.'],
      win: ['Hypothesis confirmed!'], lose: ['Well played. I need more test subjects.'],
    },
    champion: {
      greet: 'Hail, challenger!', wp: 'Well fought!', thanks: 'My thanks.',
      wow: 'A mighty blow!', oops: 'A setback, nothing more.', threat: 'Ironhold does not fall!',
      legend: ['Stand with me, legend of the keep!', 'To arms!'], low: ['I have taken worse in a tavern.'],
      win: ['Victory for Ironhold!'], lose: ['Well fought. You honor me.'],
    },
  },
  // what a bot says back to each of your emotes
  reply: { greet: 'greet', wp: 'thanks', thanks: 'wp', wow: 'threat', oops: 'wow', threat: 'threat' },
};
