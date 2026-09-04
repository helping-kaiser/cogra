A person on a stances list, with the stance the row is about.

```jsx
<StanceRow name="Tobias Lindqvist" handle="tobias" pDirected={0.7} pInterest={0.4} onOpen={openProfile}/>
<StanceRow name="Mira Voss" handle="mira" src="mira.jpg" pDirected={0.4} pInterest={0.5} onOpen={openProfile}/>
```

**The value is the row's information.** This is what separates the row from every followers list it resembles: a follow is a fact you either have or don't, so such a list shows only who. A stance has a sign and a magnitude, so a list of stances showing only who would hide the part that says something. Every stance is a public record; drawing it plainly is not a disclosure.

**Read-only, and the whole row opens the person.** There is no adjust control here — acting on a stance means going to the profile it is about, where the pad and its context are. A slider in a list row lets someone change a public record while scrolling past it.

The two directions stay separated, never merged into one list; `TabBar` is what chooses between them.
