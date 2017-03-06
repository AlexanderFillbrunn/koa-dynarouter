module.exports = {
    untype: function(o) {
        return JSON.parse(JSON.stringify(o));
    }
};