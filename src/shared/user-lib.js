export default {
    isLoggedIn: function(){
        return this.store.user.getPublicKey
    },
    signOut: function(){
        this.store.user.$reset()
    }
}