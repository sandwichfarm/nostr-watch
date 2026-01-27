<style lang="postcss">
body {
    margin: 0;
    padding: 0;
    font-family: 'Raleway', sans-serif;
    background-color: #000;
  }
  
  .text-container {
    height: 100vh;
    width: 100vw;
    display: flex;
    justify-content: center;
    align-items: center;
  }
  
  .text-container h1{
    margin: 0;
    font-size: 150px;
    color: rgba(225,225,225, .01);
    background-image: url("https://images.unsplash.com/photo-1499195333224-3ce974eecb47?ixlib=rb-0.3.5&ixid=eyJhcHBfaWQiOjEyMDd9&s=2cf549433129d4227d1879347b9e78ce&auto=format&fit=crop&w=1248&q=80");
    background-repeat: repeat;
    -webkit-background-clip:text;
    animation: animate 15s ease-in-out infinite;
    text-align: center;
    text-transform: uppercase;
    font-weight: 900;
  }
  
    @keyframes animate {
      0%, 100% {
        background-position: left top;
      }
      25%{
        background-position: right bottom;
       }
      50% {
        background-position: left bottom;
      }
      75% {
        background-position: right top;
      }   
  }
</style>