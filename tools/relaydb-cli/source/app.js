import React, { useState, useEffect } from 'react';
import { render, Box, Text, useInput } from 'ink';
// const Table = await import('ink-table').then((module) => module.default);
import { Table } from '@tqman/ink-table';
import figlet from 'figlet';

console.clear();

function getRandomElement(arr) {
    if (!Array.isArray(arr) || arr.length === 0) {
        return null; // Return null if the input is not an array or is empty
    }
    const randomIndex = Math.floor(Math.random() * arr.length);
    return arr[randomIndex];
}


const Header = () => {

    const fonts = figlet.fontsSync()

    const ascii = figlet.textSync("relaydb", {
        font: 'ANSI Regular',
        horizontalLayout: "default",
        verticalLayout: "default",
        width: 80,
        whitespaceBreak: true,
      })
    
    return (
        <Box flexDirection="column" marginBottom={1}>
            <Text>{ascii}</Text>
            <Text>Some Static Information</Text>
        </Box>
    );
};

class Relays {
    constructor(db) {
        this.db = db
        this.menu_item = "Relays";
        this.content = `Loading Stats`;
        this.tableData = [];
        this.interval = 2000
    }

    updateData(){
        const { Relay } = this.db.schemas
        // console.log(this.db)
        this.tableData = []
        this.tableData.push({status: 'All', count: this.db.relay.count.all(), size: ''})
        this.tableData.push({ status: 'Online', count: this.db.relay.count.online(), size: ''})
        // this.tableData.push({status: 'Paid', count: this.db.relay.count.paid(), size: ''})
        // this.tableData.push({status: 'Public', count: this.db.relay.count.public(), size: ''})
        this.tableData.push({status: 'Dead', count: this.db.relay.count.dead(), size: ''})
        this.tableData.push({status: 'Clearnet', count: this.db.relay.count.network('clearnet'), size: ''})
        this.tableData.push({status: 'Tor', count: this.db.relay.count.network('tor'), size: ''})
        this.tableData.push({status: 'I2P', count: this.db.relay.count.network('i2p'), size: ''})
        this.tableData.push({status: 'I2P', count: this.db.relay.count.network('cjdns'), size: ''})
    }

    // Method to return dynamic content
    getContent() {
        return this.tableData
    }
}

class Notes {
    constructor(db) {
        this.db = db
        this.menu_item = "Notes:RelayLists";
        this.content = `Loading Stats`;
        this.tableData = [];
        this.interval = 30000
    }

    updateData(){
        this.tableData = []
        this.tableData.push({Stat: 'All', Count: this.db.note.count.all(), Size: ''})
    }

    // Method to return dynamic content
    getContent() {
        return this.tableData
    }
}





const App = ({ db }) => {
    const [items, setItems] = useState([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [tableData, setTableData] = useState([]);

    useInput((input, key) => {
        if (key.upArrow) {
            setSelectedIndex(prevIndex => (prevIndex > 0 ? prevIndex - 1 : 0));
        } else if (key.downArrow) {
            setSelectedIndex(prevIndex => (prevIndex < items.length - 1 ? prevIndex + 1 : items.length - 1));
        }
        console.log("New Selected Index:", selectedIndex);
    });    

    useEffect(() => {
        const loadedItems = [
            new Relays(db),
            new Notes(db)
        ];
        setItems(loadedItems);
    
        // Function to update content based on the selected item
        const updateContent = () => {
            if (loadedItems.length > 0 && loadedItems[selectedIndex]) {
                loadedItems[selectedIndex].updateData();
                setTableData(loadedItems[selectedIndex].getContent());
            }
        };
    
        // Set up the interval with the current item's interval time
        const currentIntervalTime = loadedItems.length > 0 ? loadedItems[selectedIndex].interval : 1000; // default interval time
        const intervalId = setInterval(updateContent, currentIntervalTime);
    
        // Clean up function to clear the interval when component unmounts or dependencies change
        return () => clearInterval(intervalId);
    }, [selectedIndex, db]);
    
    

    return (
        <Box flexDirection="column">
            <Header />
            <Box flexDirection="row">
                {/* Left Column */}
                <Box width={15} flexDirection="column">
                    {items.map((item, index) => (
                        <Text key={index} color={selectedIndex === index ? 'green' : 'white'}>
                            {item.menu_item}
                        </Text>
                    ))}
                </Box>

                {/* Right Column */}
                <Box flexGrow={1} flexDirection="column" marginLeft={1}>
                    <Table data={tableData} />
                </Box>
            </Box> 
        </Box>
    );
};

// render(<App />);

export default App