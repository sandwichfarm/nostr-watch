export default {
    isLoggedIn: function(){
        return this.store.user.getPublicKey ? true : false
    },
    signOut: function(){
        this.store.user.$reset()
    }
}